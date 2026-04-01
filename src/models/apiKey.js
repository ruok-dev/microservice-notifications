'use strict';

const { query } = require('../config/database');
const { generateId, generateSecureToken, hashApiKey } = require('../utils/crypto');

const SCOPES = Object.freeze({
  NOTIFICATIONS_WRITE: 'notifications:write',
  NOTIFICATIONS_READ: 'notifications:read',
  ADMIN: 'admin',
});

/**
 * Create a new API key. Returns the raw key only once — it is never stored.
 */
async function create({ name, scopes = [SCOPES.NOTIFICATIONS_WRITE] }) {
  const id = generateId();
  const rawKey = `ns_${generateSecureToken(32)}`; // prefixed for easy identification
  const prefix = rawKey.slice(0, 8); // "ns_" + 5 chars for DB lookup
  const keyHash = await hashApiKey(rawKey);

  await query(
    `INSERT INTO api_keys (id, name, prefix, key_hash, scopes, is_active, created_at)
     VALUES ($1, $2, $3, $4, $5, true, NOW())`,
    [id, name, prefix, keyHash, JSON.stringify(scopes)],
  );

  // Return rawKey here — this is the only time it will ever be visible
  return { id, name, prefix, scopes, rawKey, createdAt: new Date() };
}

async function findById(id) {
  const result = await query(
    'SELECT id, name, prefix, scopes, is_active, created_at, last_used_at FROM api_keys WHERE id = $1',
    [id],
  );
  return result.rows[0] ?? null;
}

async function list() {
  const result = await query(
    'SELECT id, name, prefix, scopes, is_active, created_at, last_used_at FROM api_keys ORDER BY created_at DESC',
  );
  return result.rows;
}

async function revoke(id) {
  const result = await query(
    'UPDATE api_keys SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
    [id],
  );
  return result.rowCount > 0;
}

module.exports = { create, findById, list, revoke, SCOPES };
