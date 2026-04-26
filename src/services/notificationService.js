'use strict';

const Notification = require('../models/notification');
const { publish, QUEUES } = require('../config/rabbitmq');
const logger = require('../utils/logger');

class NotificationService {
  /**
   * Create and queue a notification.
   * @param {Object} data
   * @param {string} data.type - 'email' or 'webhook'
   * @param {string} data.recipient - email address or webhook URL
   * @param {string} data.subject - subject or event name
   * @param {string} data.body - content
   * @param {Object} [data.metadata] - optional metadata
   */
  static async queueNotification({ type, recipient, subject, body, metadata = {} }) {
    // 1. Persist notification in DB
    const notification = await Notification.create({
      type,
      recipient,
      subject,
      body,
      metadata,
    });

    const queue = type === Notification.TYPE.EMAIL ? QUEUES.EMAIL : QUEUES.WEBHOOK;
    
    try {
      // 2. Publish to RabbitMQ
      await publish(queue, { notificationId: notification.id });
      
      // 3. Mark as queued
      await Notification.updateStatus(notification.id, Notification.STATUS.QUEUED);
      
      logger.info({ notificationId: notification.id, type, recipient }, 'Notification successfully queued');
      
      return {
        id: notification.id,
        type: notification.type,
        status: Notification.STATUS.QUEUED,
        recipient: notification.recipient,
        subject: notification.subject,
        createdAt: notification.created_at,
      };
    } catch (err) {
      logger.error({ err, notificationId: notification.id }, 'Failed to queue notification message');
      
      // Update status to failed if we can't even queue it
      await Notification.updateStatus(notification.id, Notification.STATUS.FAILED, 'Failed to publish to queue');
      
      throw err;
    }
  }

  /**
   * Find a notification by ID.
   */
  static async getById(id) {
    return Notification.findById(id);
  }

  /**
   * List notifications with filters and pagination.
   */
  static async list(params) {
    return Notification.list(params);
  }
}

module.exports = NotificationService;
