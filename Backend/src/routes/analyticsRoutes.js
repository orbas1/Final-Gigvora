const express = require('express');
const analyticsController = require('../controllers/analyticsController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/ats/analytics/funnel', auth(), analyticsController.atsFunnel);
router.get('/interviews/analytics/load', auth(), analyticsController.interviewLoad);

module.exports = router;
