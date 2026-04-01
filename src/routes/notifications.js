'use strict';

const { Router } = require('express');
const { requireAuth, requireScope } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  emailRules,
  webhookRules,
  listRules,
  idRule,
} = require('../validators/notification');
const {
  sendEmail,
  sendWebhook,
  getNotification,
  listNotifications,
} = require('../controllers/notificationController');

const router = Router();

// All notification routes require authentication
router.use(requireAuth);

router.post(
  '/email',
  requireScope('notifications:write', 'admin'),
  emailRules,
  validate,
  sendEmail,
);

router.post(
  '/webhook',
  requireScope('notifications:write', 'admin'),
  webhookRules,
  validate,
  sendWebhook,
);

router.get(
  '/',
  requireScope('notifications:read', 'admin'),
  listRules,
  validate,
  listNotifications,
);

router.get(
  '/:id',
  requireScope('notifications:read', 'admin'),
  idRule,
  validate,
  getNotification,
);

module.exports = router;
