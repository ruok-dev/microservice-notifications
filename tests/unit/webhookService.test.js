'use strict';

process.env.JWT_SECRET = 'a'.repeat(64);
process.env.POSTGRES_USER = 'test';
process.env.POSTGRES_PASSWORD = 'test';
process.env.AWS_ACCESS_KEY_ID = 'testkey';
process.env.AWS_SECRET_ACCESS_KEY = 'testsecret';
process.env.RABBITMQ_URL = 'amqp://test:test@localhost:5672';
process.env.SES_FROM_EMAIL = 'test@test.com';
process.env.WEBHOOK_SIGNING_SECRET = 'b'.repeat(32);

const { validateWebhookUrl } = require('../../src/services/webhookService');

describe('webhookService — SSRF protection', () => {
  const privateHosts = [
    'http://localhost/hook',
    'http://127.0.0.1/hook',
    'http://10.0.0.1/hook',
    'http://172.16.0.1/hook',
    'http://192.168.1.1/hook',
    'http://0.0.0.0/hook',
    'http://169.254.169.254/latest/meta-data', // AWS metadata
  ];

  privateHosts.forEach((url) => {
    test(`blocks private/reserved address: ${url}`, () => {
      expect(() => validateWebhookUrl(url)).toThrow();
    });
  });

  test('allows valid public HTTPS URL', () => {
    expect(() => validateWebhookUrl('https://example.com/webhook')).not.toThrow();
  });

  test('allows valid public HTTP URL', () => {
    expect(() => validateWebhookUrl('http://example.com/webhook')).not.toThrow();
  });

  test('blocks non-http protocols', () => {
    expect(() => validateWebhookUrl('ftp://example.com/hook')).toThrow();
    expect(() => validateWebhookUrl('file:///etc/passwd')).toThrow();
  });

  test('blocks invalid URLs', () => {
    expect(() => validateWebhookUrl('not-a-url')).toThrow();
    expect(() => validateWebhookUrl('')).toThrow();
  });
});
