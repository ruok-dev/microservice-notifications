'use strict';

const { AppError, ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Central error handler. Converts all errors to a consistent JSON response.
 * Never leaks stack traces or internal details in production.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  // Log with full context
  const logPayload = {
    err: { message: err.message, code: err.code, stack: err.stack },
    req: { method: req.method, url: req.url, ip: req.ip },
  };

  if (err instanceof AppError && err.isOperational) {
    logger.warn(logPayload, 'Operational error');
  } else {
    // Unexpected / programming error — this is a bug
    logger.error(logPayload, 'Unexpected error');
  }

  // ── Response ─────────────────────────────────────────────
  const isDev = process.env.NODE_ENV === 'development';
  const statusCode = err.statusCode ?? 500;

  const body = {
    success: false,
    error: {
      code: err.code ?? 'INTERNAL_ERROR',
      message: err.isOperational ? err.message : 'An unexpected error occurred',
    },
  };

  // Include validation sub-errors
  if (err instanceof ValidationError && err.errors?.length) {
    body.error.details = err.errors;
  }

  // Stack trace only in development
  if (isDev && !err.isOperational) {
    body.error.stack = err.stack;
  }

  res.status(statusCode).json(body);
}

/**
 * 404 handler — must be registered after all routes.
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.path}`,
    },
  });
}

module.exports = { errorHandler, notFoundHandler };
