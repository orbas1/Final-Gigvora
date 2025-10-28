const express = require('express');
const jobController = require('../controllers/jobController');
const applicationController = require('../controllers/applicationController');
const atsController = require('../controllers/atsController');
const analyticsController = require('../controllers/analyticsController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth(false), jobController.list);
router.post('/', auth(), jobController.create);
router.get('/:id', auth(false), jobController.get);
router.patch('/:id', auth(), jobController.update);
router.delete('/:id', auth(), jobController.remove);
router.get('/:id/analytics', auth(), analyticsController.jobAnalytics);

router.get('/:id/applications', auth(), applicationController.listForJob);
router.post('/:id/applications', auth(), applicationController.createForJob);

router.get('/:id/stages', auth(), atsController.list);
router.post('/:id/stages', auth(), atsController.create);
router.patch('/:id/stages/:stageId', auth(), atsController.update);
router.delete('/:id/stages/:stageId', auth(), atsController.remove);

module.exports = router;
