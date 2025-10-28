const express = require('express');
const controller = require('../controllers/calendarController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/events', auth(), controller.list);
router.post('/events', auth(), controller.create);
router.get('/events/:id', auth(), controller.get);
router.patch('/events/:id', auth(), controller.update);
router.delete('/events/:id', auth(), controller.remove);

router.get('/ics', controller.ics);

router.post('/integrations', auth(), controller.connectIntegration);
router.delete('/integrations/:provider', auth(), controller.disconnectIntegration);

router.get('/analytics/busy-hours', auth(), controller.busyHours);

module.exports = router;
