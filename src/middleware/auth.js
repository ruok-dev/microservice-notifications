'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { query } = require('../config/database');
const { AuthenticationError, AuthorizationError } = require('../utils/errors');
const { verifyApiKey } = require('../utils/crypto');
const logger = require('../utils/logger');

/**
 * Authenticate via JWT Bearer token.
 */
async function requireJWT(req, _res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AuthenticationError('Bearer token required');
    }

    const token = authHeader.slice(7);

    // jwt.verify throws on invalid/expired tokens
    const payload = jwt.verify(token, env.security.jwtSecret, {
      algorithms: ['HS256'],
      issuer: 'notification-service',
    });

    req.auth = { type: 'jwt', subject: payload.sub, scopes: payload.scopes ?? [] };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return next(new AuthenticationError('Token expired'));
    if (err.name === 'JsonWebTokenError') return next(new AuthenticationError('Invalid token'));
    next(err);
  }
}

/**
 * Authenticate via X-API-Key header.
 * API keys are stored hashed in the database — never in plaintext.
 */
async function requireApiKey(req, _res, next) {
  try {
    const rawKey = req.headers['x-api-key'];
    if (!rawKey) throw new AuthenticationError('API key required');

    // Derive the key prefix to narrow DB lookup (first 8 chars of the raw key)
    const prefix = rawKey.slice(0, 8);

    const result = await query(
      `SELECT id, key_hash, scopes, is_active, name
       FROM api_keys
       WHERE prefix = $1 AND is_active = true
       LIMIT 1`,
      [prefix],
    );

    if (result.rowCount === 0) throw new AuthenticationError('Invalid API key');

    const apiKeyRecord = result.rows[0];
    const valid = await verifyApiKey(rawKey, apiKeyRecord.key_hash);
    if (!valid) throw new AuthenticationError('Invalid API key');

    // Update last_used_at asynchronously — don't block the request
    query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [apiKeyRecord.id]).catch((err) =>
      logger.warn({ err }, 'Failed to update api_key last_used_at'),
    );

    req.auth = { type: 'api_key', subject: apiKeyRecord.id, scopes: apiKeyRecord.scopes ?? [], name: apiKeyRecord.name };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Accept either JWT or API key — order: JWT first, then API key.
 */
async function requireAuth(req, res, next) {
  if (req.headers.authorization) return requireJWT(req, res, next);
  if (req.headers['x-api-key']) return requireApiKey(req, res, next);
  next(new AuthenticationError());
}

/**
 * Scope-based authorization guard.
 * @param {...string} scopes - required scopes (any one match is sufficient)
 */
function requireScope(...scopes) {
  return (req, _res, next) => {
    if (!req.auth) return next(new AuthenticationError());
    const hasScope = scopes.some((s) => req.auth.scopes.includes(s));
    if (!hasScope) return next(new AuthorizationError(`Required scope: ${scopes.join(' | ')}`));
    next();
  };
}

module.exports = { requireJWT, requireApiKey, requireAuth, requireScope };
