'use strict';

const { getChannel, QUEUES } = require('../config/rabbitmq');
const { dispatchWebhook } = require('../services/webhookService');
const Notification = require('../models/notification');
const logger = require('../utils/logger');

async function startWebhookConsumer() {
  const channel = getChannel();

  logger.info('Webhook consumer started, waiting for messages...');

  channel.consume(QUEUES.WEBHOOK, async (msg) => {
    if (!msg) return;

    let notification;
    try {
      const payload = JSON.parse(msg.content.toString());
      const { notificationId } = payload;

      notification = await Notification.findById(notificationId);
      if (!notification) {
        logger.warn({ notificationId }, 'Notification not found, discarding message');
        channel.ack(msg);
        return;
      }

      await Notification.updateStatus(notificationId, Notification.STATUS.PENDING);

      const result = await dispatchWebhook({
        url: notification.recipient,
        payload: {
          id: notification.id,
          subject: notification.subject,
          body: notification.body,
          metadata: notification.metadata,
          timestamp: new Date().toISOString(),
        },
        notificationId,
      });

      if (result.success) {
        await Notification.updateStatus(notificationId, Notification.STATUS.DELIVERED);
        logger.info({ notificationId }, 'Webhook notification delivered');
        channel.ack(msg);
      } else {
        throw new Error(result.error ?? `HTTP ${result.status}`);
      }
    } catch (err) {
      logger.error({ err, notificationId: notification?.id }, 'Webhook consumer error');

      const retries = notification ? await Notification.incrementRetries(notification.id) : 0;
      const maxRetries = 3;

      if (retries >= maxRetries) {
        logger.error({ notificationId: notification?.id }, 'Max retries reached — moving to DLQ');
        await Notification.updateStatus(notification.id, Notification.STATUS.FAILED, err.message);
        channel.nack(msg, false, false);
      } else {
        logger.warn({ notificationId: notification?.id, retries }, 'Requeueing webhook message');
        channel.nack(msg, false, true);
      }
    }
  });
}

module.exports = { startWebhookConsumer };
