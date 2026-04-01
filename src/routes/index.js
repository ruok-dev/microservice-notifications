'use strict';

const { Router } = require('express');
const notificationRoutes = require('./notifications');
const apiKeyRoutes = require('./apiKeys');
const { health, ping } = require('../controllers/healthController');

const router = Router();

// ── Health (public) ───────────────────────────────────────
router.get('/ping', ping);
router.get('/health', health);

// ── API routes (authenticated) ────────────────────────────
router.use('/notifications', notificationRoutes);
router.use('/api-keys', apiKeyRoutes);

module.exports = router;
