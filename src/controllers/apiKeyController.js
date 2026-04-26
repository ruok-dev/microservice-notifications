'use strict';

const ApiKey = require('../models/apiKey');
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const { NotFoundError } = require('../utils/errors');
const logger = require('../utils/logger');

const createRules = [
  body('name').isString().trim().isLength({ min: 1, max: 100 }).withMessage('name is required (max 100 chars)'),
  body('scopes')
    .optional()
    .isArray().withMessage('scopes must be an array')
    .custom((arr) => arr.every((s) => Object.values(ApiKey.SCOPES).includes(s)))
    .withMessage(`scopes must be one of: ${Object.values(ApiKey.SCOPES).join(', ')}`),
];

const revokeRules = [
  param('id').isUUID(4).withMessage('id must be a valid UUID v4'),
];

async function createApiKey(req, res, next) {
  try {
    const { name, scopes } = req.body;
    const result = await ApiKey.create({ name, scopes });

    logger.info({ apiKeyId: result.id, name }, 'API key created');

    // rawKey is returned exactly once — remind the caller to store it
    res.status(201).json({
      success: true,
      data: result,
      warning: 'Store this API key securely. It will NOT be shown again.',
    });
  } catch (err) {
    next(err);
  }
}

async function listApiKeys(req, res, next) {
  try {
    const keys = await ApiKey.list();
    res.json({ success: true, data: keys });
  } catch (err) {
    next(err);
  }
}

async function revokeApiKey(req, res, next) {
  try {
    const revoked = await ApiKey.revoke(req.params.id);
    if (!revoked) throw new NotFoundError('API key');
    logger.info({ apiKeyId: req.params.id }, 'API key revoked');
    res.json({ success: true, message: 'API key revoked' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createApiKey: [createRules, validate, createApiKey],
  listApiKeys,
  revokeApiKey: [revokeRules, validate, revokeApiKey],
};
