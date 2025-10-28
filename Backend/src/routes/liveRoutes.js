const express = require('express');
const liveController = require('../controllers/liveController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.post('/signaling/offer', auth(), liveController.offer);
router.post('/signaling/answer', auth(), liveController.answer);
router.post('/signaling/ice', auth(), liveController.ice);

module.exports = router;
