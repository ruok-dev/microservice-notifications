'use strict';

const axios = require('axios');
const env = require('../config/env');
const { signWebhookPayload } = require('../utils/crypto');
const logger = require('../utils/logger');

// Whitelist safe URL schemes — block SSRF vectors
const SAFE_PROTOCOLS = new Set(['https:', 'http:']);

function validateWebhookUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid webhook URL: ${url}`);
  }

  if (!SAFE_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(`Disallowed protocol: ${parsed.protocol}`);
  }

  // Block private/loopback ranges to prevent SSRF
  const hostname = parsed.hostname.toLowerCase();
  const ssrfPatterns = [
    /^localhost$/,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^::1$/,
    /^0\.0\.0\.0$/,
    /^169\.254\./, // link-local
    /^fd[0-9a-f]{2}:/i, // IPv6 ULA
  ];

  if (ssrfPatterns.some((p) => p.test(hostname))) {
    throw new Error(`Webhook URL targets a private/reserved address: ${hostname}`);
  }

  return parsed.toString();
}

/**
 * Dispatch a signed webhook POST request.
 * Includes retry logic with exponential-ish backoff.
 */
async function dispatchWebhook({ url, payload, notificationId, attempt = 1 }) {
  const safeUrl = validateWebhookUrl(url);
  const body = JSON.stringify(payload);
  const signature = signWebhookPayload(body);
  const deliveredAt = new Date().toISOString();

  const headers = {
    'Content-Type': 'application/json',
    'X-Notification-Id': notificationId,
    'X-Delivery-Timestamp': deliveredAt,
    'X-Signature-256': `sha256=${signature}`,
    'User-Agent': 'notification-service/1.0',
  };

  try {
    const response = await axios.post(safeUrl, body, {
      headers,
      timeout: env.webhook.timeoutMs,
      maxRedirects: 3,
      // Do not follow redirects to different hosts — SSRF mitigation
      validateStatus: (status) => status >= 200 && status < 300,
    });

    logger.info({ notificationId, url: safeUrl, status: response.status, attempt }, 'Webhook delivered');
    return { success: true, status: response.status };
  } catch (err) {
    const status = err.response?.status;
    logger.warn({ notificationId, url: safeUrl, status, attempt, error: err.message }, 'Webhook delivery failed');

    if (attempt < env.webhook.maxRetries) {
      const delay = env.webhook.retryDelayMs * attempt; // linear backoff
      logger.info({ notificationId, delay, nextAttempt: attempt + 1 }, 'Scheduling webhook retry');
      await new Promise((resolve) => setTimeout(resolve, delay));
      return dispatchWebhook({ url, payload, notificationId, attempt: attempt + 1 });
    }

    return { success: false, status, error: err.message };
  }
}

module.exports = { dispatchWebhook, validateWebhookUrl };
