const express = require('express');
const controller = require('../controllers/projectController');
const analyticsController = require('../controllers/marketplaceAnalyticsController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth(false), controller.list);
router.post('/', auth(), controller.create);
router.get('/analytics/revenue', auth(), requireRole('admin'), analyticsController.projectRevenue);
router.get('/:id', auth(false), controller.get);
router.patch('/:id', auth(), controller.update);
router.delete('/:id', auth(), controller.remove);

router.get('/:id/invites', auth(), controller.listInvites);
router.post('/:id/invites', auth(), controller.createInvite);

router.get('/:id/bids', auth(), controller.listBids);
router.post('/:id/bids', auth(), controller.createBid);

router.get('/:id/milestones', auth(), controller.listMilestones);
router.post('/:id/milestones', auth(), controller.createMilestone);

router.get('/:id/deliverables', auth(), controller.listDeliverables);
router.post('/:id/deliverables', auth(), controller.createDeliverable);

router.get('/:id/timelogs', auth(), controller.listTimeLogs);
router.post('/:id/timelogs', auth(), controller.createTimeLog);

router.get('/:id/reviews', auth(false), controller.listReviews);
router.post('/:id/reviews', auth(), controller.createReview);

module.exports = router;
