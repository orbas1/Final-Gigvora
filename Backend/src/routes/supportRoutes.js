const express = require('express');
const controller = require('../controllers/supportController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/tickets', auth(), controller.list);
router.post('/tickets', auth(), controller.create);
router.get('/tickets/:id', auth(), controller.get);
router.patch('/tickets/:id', auth(), controller.update);
router.delete('/tickets/:id', auth(), controller.remove);
router.post('/tickets/:id/messages', auth(), controller.message);
router.get('/analytics/sla', auth(), controller.analytics);

module.exports = router;
