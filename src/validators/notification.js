'use strict';

const { body, query, param } = require('express-validator');

const emailRules = [
  body('recipient')
    .isEmail().withMessage('recipient must be a valid email address')
    .normalizeEmail(),
  body('subject')
    .isString().trim()
    .isLength({ min: 1, max: 255 }).withMessage('subject must be between 1 and 255 characters'),
  body('body')
    .isString().trim()
    .isLength({ min: 1, max: 100000 }).withMessage('body must be between 1 and 100,000 characters'),
  body('metadata')
    .optional()
    .isObject().withMessage('metadata must be an object'),
  body('metadata.bodyText')
    .optional()
    .isString().trim()
    .isLength({ max: 100000 }).withMessage('metadata.bodyText must be under 100,000 characters'),
];

const webhookRules = [
  body('recipient')
    .isURL({ protocols: ['http', 'https'], require_tld: true })
    .withMessage('recipient must be a valid HTTP/HTTPS URL'),
  body('subject')
    .isString().trim()
    .isLength({ min: 1, max: 255 }).withMessage('subject must be between 1 and 255 characters'),
  body('body')
    .isString().trim()
    .isLength({ min: 1, max: 100000 }).withMessage('body must be between 1 and 100,000 characters'),
  body('metadata')
    .optional()
    .isObject().withMessage('metadata must be an object'),
];

const listRules = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('type').optional().isIn(['email', 'webhook']),
  query('status').optional().isIn(['pending', 'queued', 'delivered', 'failed']),
];

const idRule = [
  param('id').isUUID(4).withMessage('id must be a valid UUID v4'),
];

module.exports = { emailRules, webhookRules, listRules, idRule };
