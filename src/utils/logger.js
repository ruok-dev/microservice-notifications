'use strict';

const pino = require('pino');
const env = require('../config/env');

const transport = env.node.isDev
  ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' } }
  : undefined;

const logger = pino(
  {
    level: env.log.level,
    // Redact sensitive fields from logs — security measure
    redact: {
      paths: [
        'password',
        'token',
        'authorization',
        'apiKey',
        'api_key',
        'secret',
        'accessKey',
        'accessKeyId',
        'secretAccessKey',
        '*.password',
        '*.token',
        '*.secret',
        'req.headers.authorization',
        'req.headers["x-api-key"]',
      ],
      censor: '[REDACTED]',
    },
    serializers: {
      err: pino.stdSerializers.err,
      req: (req) => ({
        method: req.method,
        url: req.url,
        remoteAddress: req.remoteAddress,
      }),
    },
  },
  transport,
);

module.exports = logger;
