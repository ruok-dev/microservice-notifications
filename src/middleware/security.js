'use strict';

const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const env = require('../config/env');
const { RateLimitError } = require('../utils/errors');

/**
 * Helmet with strict security headers.
 * Disables X-Powered-By, enables HSTS, CSP, etc.
 */
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      scriptSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'no-referrer' },
  frameguard: { action: 'deny' },
  // Hide server identity
  hidePoweredBy: true,
});

/**
 * CORS — lock down to explicit origins in production.
 */
const corsMiddleware = cors({
  origin: env.node.isProd
    ? (process.env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean)
    : true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true,
  maxAge: 86400,
});

/**
 * Global rate limiter — per IP.
 */
const rateLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => req.ip,
  handler: (_req, _res, next) => next(new RateLimitError()),
});

/**
 * Strict rate limiter for auth endpoints to prevent brute force.
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  handler: (_req, _res, next) => next(new RateLimitError()),
});

const compressionMiddleware = compression();

module.exports = { helmetMiddleware, corsMiddleware, rateLimiter, authRateLimiter, compressionMiddleware };
