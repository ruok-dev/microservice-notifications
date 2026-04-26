'use strict';

const BaseConsumer = require('./BaseConsumer');
const { QUEUES } = require('../config/rabbitmq');
const { dispatchWebhook } = require('../services/webhookService');

const webhookConsumer = new BaseConsumer(QUEUES.WEBHOOK);

async function startWebhookConsumer() {
  await webhookConsumer.consume(async (notification) => {
    const result = await dispatchWebhook({
      url: notification.recipient,
      payload: {
        id: notification.id,
        subject: notification.subject,
        body: notification.body,
        metadata: notification.metadata,
        timestamp: new Date().toISOString(),
      },
      notificationId: notification.id,
    });

    if (!result.success) {
      throw new Error(result.error ?? `HTTP ${result.status}`);
    }
  });
}

module.exports = { startWebhookConsumer };
