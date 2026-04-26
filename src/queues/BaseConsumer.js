'use strict';

const { getChannel } = require('../config/rabbitmq');
const Notification = require('../models/notification');
const logger = require('../utils/logger');

class BaseConsumer {
  constructor(queueName) {
    this.queueName = queueName;
    this.maxRetries = 3;
  }

  /**
   * Start consuming from the queue.
   * @param {Function} handler - async function(notification) that returns result or throws
   */
  async consume(handler) {
    const channel = getChannel();
    logger.info({ queue: this.queueName }, 'Consumer started, waiting for messages...');

    channel.consume(this.queueName, async (msg) => {
      if (!msg) return;

      let notificationId;
      let notification;

      try {
        const payload = JSON.parse(msg.content.toString());
        notificationId = payload.notificationId;

        notification = await Notification.findById(notificationId);
        if (!notification) {
          logger.warn({ notificationId, queue: this.queueName }, 'Notification not found, discarding message');
          channel.ack(msg);
          return;
        }

        // 1. Mark as pending
        await Notification.updateStatus(notificationId, Notification.STATUS.PENDING);

        // 2. Execute handler
        await handler(notification);

        // 3. Mark as delivered
        await Notification.updateStatus(notificationId, Notification.STATUS.DELIVERED);
        logger.info({ notificationId, queue: this.queueName }, 'Notification processed successfully');

        channel.ack(msg);
      } catch (err) {
        logger.error({ err, notificationId, queue: this.queueName }, 'Consumer error');

        const retries = notification ? await Notification.incrementRetries(notificationId) : 0;

        if (retries >= this.maxRetries) {
          logger.error({ notificationId, queue: this.queueName }, 'Max retries reached — moving to DLQ');
          if (notification) {
            await Notification.updateStatus(notificationId, Notification.STATUS.FAILED, err.message);
          }
          channel.nack(msg, false, false); // Move to DLQ
        } else {
          logger.warn({ notificationId, queue: this.queueName, retries }, 'Requeueing message');
          // For simple demo, we requeue immediately. 
          // In production, we'd use a delay queue (TTL + DLX) for exponential backoff.
          channel.nack(msg, false, true); 
        }
      }
    });
  }
}

module.exports = BaseConsumer;
