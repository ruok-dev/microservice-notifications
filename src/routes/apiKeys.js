'use strict';

const { Router } = require('express');
const { requireAuth, requireScope } = require('../middleware/auth');
const { authRateLimiter } = require('../middleware/security');
const { createApiKey, listApiKeys, revokeApiKey } = require('../controllers/apiKeyController');

const router = Router();

// All API key management requires admin scope
router.use(requireAuth, requireScope('admin'));
router.use(authRateLimiter);

router.post('/', ...createApiKey);
router.get('/', listApiKeys);
router.delete('/:id', ...revokeApiKey);

module.exports = router;
