'use strict';

const { Pool } = require('pg');
const env = require('./env');
const logger = require('../utils/logger');

let pool;

function getPool() {
  if (pool) return pool;

  pool = new Pool({
    host: env.postgres.host,
    port: env.postgres.port,
    database: env.postgres.database,
    user: env.postgres.user,
    password: env.postgres.password,
    ssl: env.postgres.ssl ? { rejectUnauthorized: true } : false,
    max: env.postgres.pool.max,
    idleTimeoutMillis: env.postgres.pool.idleTimeoutMillis,
    connectionTimeoutMillis: env.postgres.pool.connectionTimeoutMillis,
    // Prevent query injection through statement_timeout
    options: '-c statement_timeout=30000',
  });

  pool.on('connect', () => {
    logger.debug('New PostgreSQL connection established');
  });

  pool.on('error', (err) => {
    logger.error({ err }, 'Unexpected error on idle PostgreSQL client');
  });

  return pool;
}

/**
 * Execute a parameterized query. Always use $1, $2... placeholders — never string interpolation.
 */
async function query(text, params = []) {
  const start = Date.now();
  const client = getPool();
  const result = await client.query(text, params);
  const duration = Date.now() - start;
  logger.debug({ query: text, duration, rows: result.rowCount }, 'query executed');
  return result;
}

/**
 * Run multiple queries in a single transaction.
 * Automatically rolls back on error.
 */
async function withTransaction(callback) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function healthCheck() {
  const result = await query('SELECT 1 AS ok');
  return result.rows[0].ok === 1;
}

async function close() {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('PostgreSQL pool closed');
  }
}

module.exports = { query, withTransaction, healthCheck, close, getPool };
