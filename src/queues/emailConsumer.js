'use strict';

const { getChannel, QUEUES } = require('../config/rabbitmq');
const { sendEmail } = require('../services/emailService');
const Notification = require('../models/notification');
const logger = require('../utils/logger');

async function startEmailConsumer() {
  const channel = getChannel();

  logger.info('Email consumer started, waiting for messages...');

  channel.consume(QUEUES.EMAIL, async (msg) => {
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

      const messageId = await sendEmail({
        to: notification.recipient,
        subject: notification.subject,
        bodyHtml: notification.body,
        bodyText: notification.metadata?.bodyText,
      });

      await Notification.updateStatus(notificationId, Notification.STATUS.DELIVERED, null);
      logger.info({ notificationId, messageId }, 'Email notification delivered');

      channel.ack(msg);
    } catch (err) {
      logger.error({ err, notificationId: notification?.id }, 'Email consumer error');

      const retries = notification ? await Notification.incrementRetries(notification.id) : 0;
      const maxRetries = 3;

      if (retries >= maxRetries) {
        logger.error({ notificationId: notification?.id }, 'Max retries reached — moving to DLQ');
        await Notification.updateStatus(notification.id, Notification.STATUS.FAILED, err.message);
        channel.nack(msg, false, false); // discard to DLQ
      } else {
        logger.warn({ notificationId: notification?.id, retries }, 'Requeueing email message');
        channel.nack(msg, false, true); // requeue
      }
    }
  });
}

module.exports = { startEmailConsumer };
