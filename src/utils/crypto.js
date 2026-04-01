'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const env = require('../config/env');

/**
 * Generate a cryptographically secure random token.
 * @param {number} bytes - number of random bytes (default 32)
 * @returns {string} hex-encoded token
 */
function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Generate a v4-like unique ID using crypto.
 */
function generateId() {
  return crypto.randomUUID();
}

/**
 * Hash an API key using bcrypt before storage.
 */
async function hashApiKey(apiKey) {
  return bcrypt.hash(apiKey, env.security.apiKeySaltRounds);
}

/**
 * Verify an API key against its stored hash.
 */
async function verifyApiKey(apiKey, hash) {
  return bcrypt.compare(apiKey, hash);
}

/**
 * Create an HMAC-SHA256 signature for webhook payloads.
 * Receivers can validate requests came from this service.
 */
function signWebhookPayload(payload) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto.createHmac('sha256', env.webhook.signingSecret).update(body).digest('hex');
}

/**
 * Timing-safe comparison of two strings to prevent timing attacks.
 */
function safeCompare(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = { generateSecureToken, generateId, hashApiKey, verifyApiKey, signWebhookPayload, safeCompare };
