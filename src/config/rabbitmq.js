'use strict';

const amqplib = require('amqplib');
const env = require('./env');
const logger = require('../utils/logger');

const QUEUES = {
  EMAIL: 'notifications.email',
  WEBHOOK: 'notifications.webhook',
  DEAD_LETTER: 'notifications.dead_letter',
};

const EXCHANGES = {
  NOTIFICATIONS: 'notifications',
  DEAD_LETTER: 'notifications.dlx',
};

let connection = null;
let channel = null;
let reconnecting = false;

async function connect() {
  try {
    connection = await amqplib.connect(env.rabbitmq.url);

    connection.on('error', (err) => {
      logger.error({ err }, 'RabbitMQ connection error');
      scheduleReconnect();
    });

    connection.on('close', () => {
      logger.warn('RabbitMQ connection closed — scheduling reconnect');
      scheduleReconnect();
    });

    channel = await connection.createChannel();
    channel.prefetch(env.rabbitmq.prefetch);

    // ── Dead Letter Exchange ──────────────────────────────────
    await channel.assertExchange(EXCHANGES.DEAD_LETTER, 'direct', { durable: true });
    await channel.assertQueue(QUEUES.DEAD_LETTER, { durable: true });
    await channel.bindQueue(QUEUES.DEAD_LETTER, EXCHANGES.DEAD_LETTER, QUEUES.DEAD_LETTER);

    // ── Main Exchange ─────────────────────────────────────────
    await channel.assertExchange(EXCHANGES.NOTIFICATIONS, 'direct', { durable: true });

    const queueOptions = {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': EXCHANGES.DEAD_LETTER,
        'x-dead-letter-routing-key': QUEUES.DEAD_LETTER,
        'x-message-ttl': 86400000, // 24h TTL
      },
    };

    await channel.assertQueue(QUEUES.EMAIL, queueOptions);
    await channel.assertQueue(QUEUES.WEBHOOK, queueOptions);

    await channel.bindQueue(QUEUES.EMAIL, EXCHANGES.NOTIFICATIONS, QUEUES.EMAIL);
    await channel.bindQueue(QUEUES.WEBHOOK, EXCHANGES.NOTIFICATIONS, QUEUES.WEBHOOK);

    reconnecting = false;
    logger.info('RabbitMQ connected and topology asserted');

    return channel;
  } catch (err) {
    logger.error({ err }, 'Failed to connect to RabbitMQ');
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnecting) return;
  reconnecting = true;
  connection = null;
  channel = null;
  setTimeout(connect, env.rabbitmq.reconnectDelay);
}

function getChannel() {
  if (!channel) throw new Error('RabbitMQ channel not available');
  return channel;
}

/**
 * Publish a message to the notifications exchange.
 * Messages are persistent (survive broker restarts).
 */
function publish(queue, payload) {
  const ch = getChannel();
  const buffer = Buffer.from(JSON.stringify(payload));
  return ch.publish(EXCHANGES.NOTIFICATIONS, queue, buffer, {
    persistent: true,
    contentType: 'application/json',
    timestamp: Date.now(),
  });
}

async function close() {
  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
    channel = null;
    connection = null;
    logger.info('RabbitMQ connection closed');
  } catch (err) {
    logger.error({ err }, 'Error closing RabbitMQ connection');
  }
}

module.exports = { connect, getChannel, publish, close, QUEUES, EXCHANGES };
