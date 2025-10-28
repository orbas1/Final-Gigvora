const express = require('express');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const profileRoutes = require('./profileRoutes');
const connectionRoutes = require('./connectionRoutes');
const postRoutes = require('./postRoutes');
const notificationRoutes = require('./notificationRoutes');
const fileRoutes = require('./fileRoutes');
const tagRoutes = require('./tagRoutes');
const skillRoutes = require('./skillRoutes');
const settingsRoutes = require('./settingsRoutes');
const adminRoutes = require('./adminRoutes');
const supportRoutes = require('./supportRoutes');
const verificationRoutes = require('./verificationRoutes');
const webhookRoutes = require('./webhookRoutes');
const legalRoutes = require('./legalRoutes');
const { idempotencyMiddleware } = require('../middleware/idempotency');

const router = express.Router();

router.use(idempotencyMiddleware);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/profiles', profileRoutes);
router.use('/connections', connectionRoutes);
router.use('/posts', postRoutes);
router.use('/notifications', notificationRoutes);
router.use('/files', fileRoutes);
router.use('/tags', tagRoutes);
router.use('/skills', skillRoutes);
router.use('/settings', settingsRoutes);
router.use('/admin', adminRoutes);
router.use('/support', supportRoutes);
router.use('/verification', verificationRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/legal', legalRoutes);

module.exports = router;
