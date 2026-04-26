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
    test(`blocks private/reserved address: ${url}`, async () => {
      await expect(validateWebhookUrl(url)).rejects.toThrow();
    });
  });

  test('allows valid public HTTPS URL', async () => {
    await expect(validateWebhookUrl('https://google.com/webhook')).resolves.toBeDefined();
  });

  test('allows valid public HTTP URL', async () => {
    await expect(validateWebhookUrl('http://google.com/webhook')).resolves.toBeDefined();
  });

  test('blocks non-http protocols', async () => {
    await expect(validateWebhookUrl('ftp://example.com/hook')).rejects.toThrow();
    await expect(validateWebhookUrl('file:///etc/passwd')).rejects.toThrow();
  });

  test('blocks invalid URLs', async () => {
    await expect(validateWebhookUrl('not-a-url')).rejects.toThrow();
    await expect(validateWebhookUrl('')).rejects.toThrow();
  });
});
