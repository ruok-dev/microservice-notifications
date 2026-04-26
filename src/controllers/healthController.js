'use strict';

const { healthCheck: dbHealthCheck } = require('../config/database');
const { getChannel } = require('../config/rabbitmq');
const logger = require('../utils/logger');

async function health(req, res) {
  const checks = {};
  let allHealthy = true;

  // ── PostgreSQL ────────────────────────────────────────────
  try {
    await dbHealthCheck();
    checks.postgres = { status: 'up' };
  } catch (err) {
    checks.postgres = { status: 'down', error: err.message };
    allHealthy = false;
    logger.warn({ err }, 'Health check: PostgreSQL is down');
  }

  // ── RabbitMQ ──────────────────────────────────────────────
  try {
    getChannel(); // throws if not connected
    checks.rabbitmq = { status: 'up' };
  } catch (err) {
    checks.rabbitmq = { status: 'down', error: err.message };
    allHealthy = false;
    logger.warn({ err }, 'Health check: RabbitMQ is down');
  }

  const statusCode = allHealthy ? 200 : 503;
  res.status(statusCode).json({
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks,
  });
}

// Lightweight liveness probe — no external checks
function ping(req, res) {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
}

module.exports = { health, ping };
