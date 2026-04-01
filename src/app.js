'use strict';

const express = require('express');
const env = require('./config/env');
const {
  helmetMiddleware,
  corsMiddleware,
  rateLimiter,
  compressionMiddleware,
} = require('./middleware/security');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const routes = require('./routes');
const logger = require('./utils/logger');

function createApp() {
  const app = express();

  // ── Security Middleware ───────────────────────────────────
  app.use(helmetMiddleware);
  app.use(corsMiddleware);
  app.use(rateLimiter);
  app.use(compressionMiddleware);

  // ── Trust proxy (for correct IP behind load balancer) ────
  if (env.node.isProd) {
    app.set('trust proxy', 1);
  }

  // ── Body Parsing — limit size to prevent DoS ─────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  // ── Request Logging ───────────────────────────────────────
  app.use((req, _res, next) => {
    logger.info({ method: req.method, url: req.url, ip: req.ip }, 'Incoming request');
    next();
  });

  // ── Routes ────────────────────────────────────────────────
  app.use(`/api/${env.node.apiVersion}`, routes);

  // ── 404 & Error Handlers (must be last) ──────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
