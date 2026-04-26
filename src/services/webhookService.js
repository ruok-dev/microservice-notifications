'use strict';

const axios = require('axios');
const dns = require('dns').promises;
const ipaddr = require('ipaddr.js');
const env = require('../config/env');
const { signWebhookPayload } = require('../utils/crypto');
const logger = require('../utils/logger');

// Whitelist safe URL schemes — block SSRF vectors
const SAFE_PROTOCOLS = new Set(['https:', 'http:']);

/**
 * Validates a URL and ensures it doesn't point to a private/reserved IP.
 * Mitigates SSRF (Server-Side Request Forgery) by resolving DNS and checking the IP range.
 */
async function validateWebhookUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid webhook URL: ${url}`);
  }

  if (!SAFE_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(`Disallowed protocol: ${parsed.protocol}`);
  }

  const hostname = parsed.hostname;

  // 1. Basic string check for obvious local targets
  const ssrfPatterns = [/localhost/i, /127\.0\.0\.1/, /0\.0\.0\.0/];
  if (ssrfPatterns.some((p) => p.test(hostname))) {
    throw new Error(`Webhook URL targets a blocked hostname: ${hostname}`);
  }

  // 2. DNS resolution and IP range check
  try {
    const lookup = await dns.lookup(hostname);
    const ip = lookup.address;
    const addr = ipaddr.parse(ip);
    const range = addr.range();

    // Block private, loopback, link-local, multicast, etc.
    const unsafeRanges = ['loopback', 'private', 'linkLocal', 'multicast', 'unspecified', 'reserved'];
    
    if (unsafeRanges.includes(range)) {
      throw new Error(`Webhook URL resolves to an unsafe IP range (${range}): ${ip}`);
    }
  } catch (err) {
    if (err.code === 'ENOTFOUND') {
      throw new Error(`Could not resolve hostname: ${hostname}`);
    }
    // If it's already an IP, ipaddr.parse might fail if it's invalid, 
    // but dns.lookup handles IP strings fine.
    throw err;
  }

  return parsed.toString();
}

/**
 * Dispatch a signed webhook POST request.
 * Reliable delivery is handled via RabbitMQ retries in BaseConsumer.
 */
async function dispatchWebhook({ url, payload, notificationId }) {
  try {
    const safeUrl = await validateWebhookUrl(url);
    const body = JSON.stringify(payload);
    const signature = signWebhookPayload(body);
    const deliveredAt = new Date().toISOString();

    const headers = {
      'Content-Type': 'application/json',
      'X-Notification-Id': notificationId,
      'X-Delivery-Timestamp': deliveredAt,
      'X-Signature-256': `sha256=${signature}`,
      'User-Agent': 'notification-service/1.1',
    };

    const response = await axios.post(safeUrl, body, {
      headers,
      timeout: env.webhook.timeoutMs,
      maxRedirects: 0, // Block redirects to prevent SSRF bypass via redirect to local IP
      validateStatus: (status) => status >= 200 && status < 300,
    });

    logger.info({ notificationId, url: safeUrl, status: response.status }, 'Webhook delivered');
    return { success: true, status: response.status };
  } catch (err) {
    const status = err.response?.status;
    logger.warn({ notificationId, url, status, error: err.message }, 'Webhook delivery failed');

    return { success: false, status, error: err.message };
  }
}

module.exports = { dispatchWebhook, validateWebhookUrl };
