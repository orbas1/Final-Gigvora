const express = require('express');
const controller = require('../controllers/userController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth(), controller.list);
router.post('/', auth(), requireRole('admin'), controller.create);
router.get('/analytics/retention', auth(), controller.retention);
router.get('/analytics/actives', auth(), controller.actives);
router.get('/:id/analytics/overview', auth(), controller.overviewAnalytics);
router.get('/:id/followers', auth(), controller.followers);
router.get('/:id/following', auth(), controller.following);
router.post('/:id/follow', auth(), controller.follow);
router.delete('/:id/follow', auth(), controller.unfollow);
router.post('/:id/block', auth(), controller.block);
router.delete('/:id/block', auth(), controller.unblock);
router.post('/:id/report', auth(), controller.report);
router.get('/:id', auth(), controller.get);
router.patch('/:id', auth(), controller.update);
router.delete('/:id', auth(), controller.remove);

module.exports = router;
