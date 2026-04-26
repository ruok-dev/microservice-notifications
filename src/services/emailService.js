'use strict';

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const env = require('../config/env');
const logger = require('../utils/logger');

const sesClient = new SESClient({
  region: env.aws.region,
  credentials: {
    accessKeyId: env.aws.accessKeyId,
    secretAccessKey: env.aws.secretAccessKey,
  },
});

/**
 * Send a transactional email via AWS SES.
 * @param {Object} opts
 * @param {string} opts.to - recipient email address
 * @param {string} opts.subject - email subject
 * @param {string} opts.bodyHtml - HTML body (optional)
 * @param {string} opts.bodyText - Plain text body (optional — always provide at least one)
 */
async function sendEmail({ to, subject, bodyHtml, bodyText }) {
  if (!bodyHtml && !bodyText) {
    throw new Error('At least one of bodyHtml or bodyText must be provided');
  }

  const command = new SendEmailCommand({
    Source: `${env.aws.ses.fromName} <${env.aws.ses.fromEmail}>`,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: {
        ...(bodyHtml && { Html: { Data: bodyHtml, Charset: 'UTF-8' } }),
        ...(bodyText && { Text: { Data: bodyText, Charset: 'UTF-8' } }),
      },
    },
    // Prevent SES from tracking pixels — privacy-first
    ConfigurationSetName: undefined,
  });

  const response = await sesClient.send(command);
  logger.info({ messageId: response.MessageId, to }, 'Email sent via SES');
  return response.MessageId;
}

module.exports = { sendEmail };
