const express = require('express');
const controller = require('../controllers/notificationController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth(), controller.list);
router.patch('/:id/read', auth(), controller.markRead);
router.patch('/read-all', auth(), controller.markAll);
router.get('/preferences', auth(), controller.getPreferences);
router.patch('/preferences', auth(), controller.updatePreferences);
router.get('/analytics/delivery', auth(), requireRole('admin'), controller.analytics);

module.exports = router;
