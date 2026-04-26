'use strict';

const BaseConsumer = require('./BaseConsumer');
const { QUEUES } = require('../config/rabbitmq');
const { sendEmail } = require('../services/emailService');

const emailConsumer = new BaseConsumer(QUEUES.EMAIL);

async function startEmailConsumer() {
  await emailConsumer.consume(async (notification) => {
    await sendEmail({
      to: notification.recipient,
      subject: notification.subject,
      bodyHtml: notification.body,
      bodyText: notification.metadata?.bodyText,
    });
  });
}

module.exports = { startEmailConsumer };
