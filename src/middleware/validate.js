'use strict';

const { validationResult } = require('express-validator');
const { ValidationError } = require('../utils/errors');

/**
 * Run express-validator chains and throw a ValidationError on failure.
 * Usage: router.post('/path', [...validationChains], validate, handler)
 */
function validate(req, _res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const errors = result.array().map(({ path, msg, value }) => ({
    field: path,
    message: msg,
    // Never expose raw values that might contain secrets
    received: typeof value === 'string' && value.length > 50 ? '[truncated]' : value,
  }));

  next(new ValidationError('Validation failed', errors));
}

module.exports = { validate };
