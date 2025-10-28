const express = require('express');
const controller = require('../controllers/verificationController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.post('/start', auth(), controller.start);
router.get('/status', auth(), controller.status);
router.post('/webhook', controller.webhook);

module.exports = router;
