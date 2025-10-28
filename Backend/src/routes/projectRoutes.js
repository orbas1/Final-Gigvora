const express = require('express');
const projectController = require('../controllers/projectController');

const router = express.Router();

router.get('/analytics/revenue', projectController.revenueAnalytics);

router.get('/', projectController.listProjects);
router.post('/', projectController.createProject);
router.get('/:id', projectController.getProject);
router.patch('/:id', projectController.updateProject);
router.delete('/:id', projectController.deleteProject);

router.get('/:id/invites', projectController.listInvites);
router.post('/:id/invites', projectController.createInvite);

router.get('/:id/bids', projectController.listBids);
router.post('/:id/bids', projectController.createBid);
router.patch('/bids/:bidId', projectController.updateBid);
router.delete('/bids/:bidId', projectController.deleteBid);

router.get('/:id/milestones', projectController.listMilestones);
router.post('/:id/milestones', projectController.createMilestone);
router.patch('/milestones/:milestoneId', projectController.updateMilestone);
router.delete('/milestones/:milestoneId', projectController.deleteMilestone);

router.get('/:id/deliverables', projectController.listDeliverables);
router.post('/:id/deliverables', projectController.createDeliverable);
router.patch('/deliverables/:deliverableId', projectController.updateDeliverable);
router.delete('/deliverables/:deliverableId', projectController.deleteDeliverable);

router.get('/:id/timelogs', projectController.listTimeLogs);
router.post('/:id/timelogs', projectController.createTimeLog);
router.patch('/timelogs/:timeLogId', projectController.updateTimeLog);
router.delete('/timelogs/:timeLogId', projectController.deleteTimeLog);

router.get('/:id/reviews', projectController.listReviews);
router.post('/:id/reviews', projectController.createReview);

module.exports = router;
