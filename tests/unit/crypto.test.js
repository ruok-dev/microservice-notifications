'use strict';

// Mock env before requiring modules
process.env.JWT_SECRET = 'a'.repeat(64);
process.env.POSTGRES_USER = 'test';
process.env.POSTGRES_PASSWORD = 'test';
process.env.AWS_ACCESS_KEY_ID = 'testkey';
process.env.AWS_SECRET_ACCESS_KEY = 'testsecret';
process.env.RABBITMQ_URL = 'amqp://test:test@localhost:5672';
process.env.SES_FROM_EMAIL = 'test@test.com';
process.env.WEBHOOK_SIGNING_SECRET = 'b'.repeat(32);

const {
  generateSecureToken,
  generateId,
  signWebhookPayload,
  safeCompare,
  hashApiKey,
  verifyApiKey,
} = require('../../src/utils/crypto');

describe('crypto utils', () => {
  test('generateSecureToken returns hex string of correct length', () => {
    const token = generateSecureToken(32);
    expect(token).toHaveLength(64); // 32 bytes = 64 hex chars
    expect(/^[a-f0-9]+$/.test(token)).toBe(true);
  });

  test('generateSecureToken returns unique values', () => {
    const a = generateSecureToken();
    const b = generateSecureToken();
    expect(a).not.toBe(b);
  });

  test('generateId returns a valid UUID v4', () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  test('signWebhookPayload returns consistent HMAC for same input', () => {
    const payload = { event: 'test', data: 'hello' };
    const sig1 = signWebhookPayload(payload);
    const sig2 = signWebhookPayload(payload);
    expect(sig1).toBe(sig2);
  });

  test('signWebhookPayload produces different signatures for different payloads', () => {
    const sig1 = signWebhookPayload({ a: 1 });
    const sig2 = signWebhookPayload({ a: 2 });
    expect(sig1).not.toBe(sig2);
  });

  test('safeCompare correctly identifies equal strings', () => {
    expect(safeCompare('hello', 'hello')).toBe(true);
  });

  test('safeCompare correctly identifies unequal strings', () => {
    expect(safeCompare('hello', 'world')).toBe(false);
  });

  test('safeCompare handles different lengths', () => {
    expect(safeCompare('short', 'much_longer_string')).toBe(false);
  });

  test('hashApiKey and verifyApiKey work together', async () => {
    const key = 'ns_mysupersecretapikey123';
    const hash = await hashApiKey(key);
    expect(hash).not.toBe(key);
    expect(hash.startsWith('$2')).toBe(true); // bcrypt prefix
    const valid = await verifyApiKey(key, hash);
    expect(valid).toBe(true);
    const invalid = await verifyApiKey('wrong_key', hash);
    expect(invalid).toBe(false);
  });
});
