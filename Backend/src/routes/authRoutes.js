const express = require('express');
const controller = require('../controllers/authController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.post('/register', controller.register);
router.post('/login', controller.login);
router.post('/refresh', controller.refresh);
router.post('/logout', auth(), controller.logout);
router.post('/forgot', controller.forgot);
router.post('/reset', controller.reset);
router.post('/verify-email', controller.verifyEmail);
router.post('/otp', controller.sendOtp);
router.post('/2fa/setup', auth(), controller.setup2fa);
router.post('/2fa/verify', auth(), controller.verify2fa);
router.delete('/2fa', auth(), controller.disable2fa);
router.get('/me', auth(), controller.me);
router.post('/switch-role', auth(), controller.switchRole);
router.get('/analytics/registrations', auth(), controller.analytics);

module.exports = router;
