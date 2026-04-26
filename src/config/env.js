'use strict';

require('dotenv').config();

/**
 * Validates that a required environment variable is set.
 * Throws immediately at startup if anything is missing — fail fast, fail loud.
 */
function required(key) {
  const value = process.env[key];
  if (!value || value.startsWith('CHANGE_ME')) {
    throw new Error(`[Config] Missing or unconfigured environment variable: ${key}`);
  }
  return value;
}

function optional(key, defaultValue = '') {
  return process.env[key] ?? defaultValue;
}

function optionalInt(key, defaultValue) {
  const val = process.env[key];
  if (!val) return defaultValue;
  const parsed = parseInt(val, 10);
  if (Number.isNaN(parsed)) throw new Error(`[Config] ${key} must be an integer`);
  return parsed;
}

function optionalBool(key, defaultValue = false) {
  const val = process.env[key];
  if (!val) return defaultValue;
  return val.toLowerCase() === 'true';
}

const env = {
  node: {
    env: optional('NODE_ENV', 'development'),
    port: optionalInt('PORT', 3000),
    apiVersion: optional('API_VERSION', 'v1'),
    isDev: optional('NODE_ENV', 'development') === 'development',
    isProd: optional('NODE_ENV', 'development') === 'production',
    isTest: optional('NODE_ENV', 'development') === 'test',
  },

  security: {
    jwtSecret: required('JWT_SECRET'),
    jwtExpiresIn: optional('JWT_EXPIRES_IN', '1h'),
    apiKeySaltRounds: optionalInt('API_KEY_SALT_ROUNDS', 12),
  },

  postgres: {
    host: optional('POSTGRES_HOST', 'localhost'),
    port: optionalInt('POSTGRES_PORT', 5432),
    database: optional('POSTGRES_DB', 'notification_service'),
    user: required('POSTGRES_USER'),
    password: required('POSTGRES_PASSWORD'),
    ssl: optionalBool('POSTGRES_SSL', false),
    pool: {
      max: optionalInt('POSTGRES_POOL_MAX', 10),
      idleTimeoutMillis: optionalInt('POSTGRES_POOL_IDLE_TIMEOUT', 30000),
      connectionTimeoutMillis: optionalInt('POSTGRES_POOL_CONNECTION_TIMEOUT', 2000),
    },
  },

  rabbitmq: {
    url: required('RABBITMQ_URL'),
    prefetch: optionalInt('RABBITMQ_PREFETCH', 5),
    reconnectDelay: optionalInt('RABBITMQ_RECONNECT_DELAY', 5000),
  },

  aws: {
    region: optional('AWS_REGION', 'us-east-1'),
    accessKeyId: required('AWS_ACCESS_KEY_ID'),
    secretAccessKey: required('AWS_SECRET_ACCESS_KEY'),
    ses: {
      fromEmail: required('SES_FROM_EMAIL'),
      fromName: optional('SES_FROM_NAME', 'Notification Service'),
    },
  },

  webhook: {
    timeoutMs: optionalInt('WEBHOOK_TIMEOUT_MS', 10000),
    maxRetries: optionalInt('WEBHOOK_MAX_RETRIES', 3),
    retryDelayMs: optionalInt('WEBHOOK_RETRY_DELAY_MS', 5000),
    signingSecret: required('WEBHOOK_SIGNING_SECRET'),
  },

  rateLimit: {
    windowMs: optionalInt('RATE_LIMIT_WINDOW_MS', 900000),
    max: optionalInt('RATE_LIMIT_MAX_REQUESTS', 100),
  },

  log: {
    level: optional('LOG_LEVEL', 'info'),
  },
};

module.exports = env;
