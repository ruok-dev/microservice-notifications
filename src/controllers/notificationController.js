'use strict';

const Notification = require('../models/notification');
const { publish, QUEUES } = require('../config/rabbitmq');
const logger = require('../utils/logger');

async function sendEmail(req, res, next) {
  try {
    const { recipient, subject, body, metadata } = req.body;

    const notification = await Notification.create({
      type: Notification.TYPE.EMAIL,
      recipient,
      subject,
      body,
      metadata,
    });

    publish(QUEUES.EMAIL, { notificationId: notification.id });
    await Notification.updateStatus(notification.id, Notification.STATUS.QUEUED);

    logger.info({ notificationId: notification.id, recipient }, 'Email notification queued');

    res.status(202).json({
      success: true,
      data: {
        id: notification.id,
        type: notification.type,
        status: Notification.STATUS.QUEUED,
        recipient,
        subject,
        createdAt: notification.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function sendWebhook(req, res, next) {
  try {
    const { recipient, subject, body, metadata } = req.body;

    const notification = await Notification.create({
      type: Notification.TYPE.WEBHOOK,
      recipient,
      subject,
      body,
      metadata,
    });

    publish(QUEUES.WEBHOOK, { notificationId: notification.id });
    await Notification.updateStatus(notification.id, Notification.STATUS.QUEUED);

    logger.info({ notificationId: notification.id, url: recipient }, 'Webhook notification queued');

    res.status(202).json({
      success: true,
      data: {
        id: notification.id,
        type: notification.type,
        status: Notification.STATUS.QUEUED,
        recipient,
        subject,
        createdAt: notification.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getNotification(req, res, next) {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Notification not found' } });
    }
    res.json({ success: true, data: notification });
  } catch (err) {
    next(err);
  }
}

async function listNotifications(req, res, next) {
  try {
    const { page, limit, type, status } = req.query;
    const result = await Notification.list({ page, limit, type, status });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

module.exports = { sendEmail, sendWebhook, getNotification, listNotifications };
