'use strict';

const { query, withTransaction } = require('../config/database');
const { generateId } = require('../utils/crypto');

const STATUS = Object.freeze({
  PENDING: 'pending',
  QUEUED: 'queued',
  DELIVERED: 'delivered',
  FAILED: 'failed',
});

const TYPE = Object.freeze({
  EMAIL: 'email',
  WEBHOOK: 'webhook',
});

async function create({ type, recipient, subject, body, metadata = {} }) {
  const id = generateId();
  const result = await query(
    `INSERT INTO notifications (id, type, recipient, subject, body, metadata, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
     RETURNING *`,
    [id, type, recipient, subject, body, JSON.stringify(metadata), STATUS.PENDING],
  );
  return result.rows[0];
}

async function findById(id) {
  const result = await query('SELECT * FROM notifications WHERE id = $1', [id]);
  return result.rows[0] ?? null;
}

async function list({ page = 1, limit = 20, type, status } = {}) {
  const safeLimit = Math.min(limit, 100);
  const offset = (page - 1) * safeLimit;
  const conditions = [];
  const params = [];

  if (type) { params.push(type); conditions.push(`type = $${params.length}`); }
  if (status) { params.push(status); conditions.push(`status = $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(safeLimit, offset);

  const [rows, count] = await Promise.all([
    query(`SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params),
    query(`SELECT COUNT(*) AS total FROM notifications ${where}`, params.slice(0, -2)),
  ]);

  return { data: rows.rows, total: parseInt(count.rows[0].total, 10), page, limit: safeLimit };
}

async function updateStatus(id, status, errorMessage = null) {
  const result = await query(
    `UPDATE notifications
     SET status = $1, error_message = $2, updated_at = NOW(),
         delivered_at = CASE WHEN $1 = 'delivered' THEN NOW() ELSE delivered_at END
     WHERE id = $3
     RETURNING *`,
    [status, errorMessage, id],
  );
  return result.rows[0] ?? null;
}

async function incrementRetries(id) {
  const result = await query(
    'UPDATE notifications SET retry_count = retry_count + 1, updated_at = NOW() WHERE id = $1 RETURNING retry_count',
    [id],
  );
  return result.rows[0]?.retry_count ?? 0;
}

module.exports = { create, findById, list, updateStatus, incrementRetries, STATUS, TYPE };
