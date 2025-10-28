const express = require('express');
const controller = require('../controllers/settingsController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/account', auth(), controller.getAccount);
router.patch('/account', auth(), controller.updateAccount);

router.get('/security', auth(), controller.getSecurity);
router.patch('/security', auth(), controller.updateSecurity);

router.get('/privacy', auth(), controller.getPrivacy);
router.patch('/privacy', auth(), controller.updatePrivacy);

router.get('/notifications', auth(), controller.getNotifications);
router.patch('/notifications', auth(), controller.updateNotifications);

router.get('/payments', auth(), controller.getPayments);
router.patch('/payments', auth(), controller.updatePayments);

router.get('/theme', auth(), controller.getTheme);
router.patch('/theme', auth(), controller.updateTheme);

router.get('/api-tokens', auth(), controller.listApiTokens);
router.post('/api-tokens', auth(), controller.createApiToken);
router.delete('/api-tokens/:id', auth(), controller.deleteApiToken);

module.exports = router;
