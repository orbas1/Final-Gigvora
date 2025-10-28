const express = require('express');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const profileRoutes = require('./profileRoutes');
const connectionRoutes = require('./connectionRoutes');
const postRoutes = require('./postRoutes');
const notificationRoutes = require('./notificationRoutes');
const fileRoutes = require('./fileRoutes');
const settingsRoutes = require('./settingsRoutes');
const adminRoutes = require('./adminRoutes');
const supportRoutes = require('./supportRoutes');
const verificationRoutes = require('./verificationRoutes');
const webhookRoutes = require('./webhookRoutes');
const legalRoutes = require('./legalRoutes');
const projectRoutes = require('./projectRoutes');
const gigRoutes = require('./gigRoutes');
const projectController = require('../controllers/projectController');
const gigController = require('../controllers/gigController');
const { auth } = require('../middleware/auth');
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
router.use('/settings', settingsRoutes);
router.use('/admin', adminRoutes);
router.use('/support', supportRoutes);
router.use('/verification', verificationRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/legal', legalRoutes);
router.use('/projects', projectRoutes);
router.use('/gigs', gigRoutes);

router.patch('/bids/:id', auth(), projectController.updateBid);
router.delete('/bids/:id', auth(), projectController.deleteBid);
router.patch('/milestones/:id', auth(), projectController.updateMilestone);
router.delete('/milestones/:id', auth(), projectController.deleteMilestone);
router.patch('/deliverables/:id', auth(), projectController.updateDeliverable);
router.delete('/deliverables/:id', auth(), projectController.deleteDeliverable);
router.patch('/timelogs/:id', auth(), projectController.updateTimeLog);
router.delete('/timelogs/:id', auth(), projectController.deleteTimeLog);

router.get('/orders/:id', auth(), gigController.getOrder);
router.patch('/orders/:id', auth(), gigController.updateOrder);
router.post('/orders/:id/cancel', auth(), gigController.cancelOrder);
router.get('/orders/:id/submissions', auth(), gigController.listSubmissions);
router.post('/orders/:id/submissions', auth(), gigController.createSubmission);
router.patch('/submissions/:id', auth(), gigController.updateSubmission);
router.get('/orders/:id/reviews', auth(), gigController.listReviews);
router.post('/orders/:id/reviews', auth(), gigController.createReview);

module.exports = router;
