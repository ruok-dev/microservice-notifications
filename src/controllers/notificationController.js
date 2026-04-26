'use strict';

const NotificationService = require('../services/notificationService');

async function sendEmail(req, res, next) {
  try {
    const { recipient, subject, body, metadata } = req.body;
    
    const result = await NotificationService.queueNotification({
      type: 'email',
      recipient,
      subject,
      body,
      metadata,
    });

    res.status(202).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function sendWebhook(req, res, next) {
  try {
    const { recipient, subject, body, metadata } = req.body;
    
    const result = await NotificationService.queueNotification({
      type: 'webhook',
      recipient,
      subject,
      body,
      metadata,
    });

    res.status(202).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function getNotification(req, res, next) {
  try {
    const notification = await NotificationService.getById(req.params.id);
    if (!notification) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Notification not found' },
      });
    }
    res.json({ success: true, data: notification });
  } catch (err) {
    next(err);
  }
}

async function listNotifications(req, res, next) {
  try {
    const { page, limit, type, status } = req.query;
    const result = await NotificationService.list({ page, limit, type, status });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

module.exports = { sendEmail, sendWebhook, getNotification, listNotifications };
