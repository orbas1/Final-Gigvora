const express = require('express');
const controller = require('../controllers/settingsController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/account', auth(), controller.getAccount);
router.patch('/account', auth(), controller.updateAccount);
router.put('/account', auth(), controller.updateAccount);
router.delete('/account', auth(), controller.resetAccount);

router.get('/security', auth(), controller.getSecurity);
router.patch('/security', auth(), controller.updateSecurity);
router.put('/security', auth(), controller.updateSecurity);
router.delete('/security', auth(), controller.resetSecurity);

router.get('/privacy', auth(), controller.getPrivacy);
router.patch('/privacy', auth(), controller.updatePrivacy);
router.put('/privacy', auth(), controller.updatePrivacy);
router.delete('/privacy', auth(), controller.resetPrivacy);

router.get('/notifications', auth(), controller.getNotifications);
router.patch('/notifications', auth(), controller.updateNotifications);
router.put('/notifications', auth(), controller.updateNotifications);
router.delete('/notifications', auth(), controller.resetNotifications);

router.get('/payments', auth(), controller.getPayments);
router.patch('/payments', auth(), controller.updatePayments);
router.put('/payments', auth(), controller.updatePayments);
router.delete('/payments', auth(), controller.resetPayments);

router.get('/theme', auth(), controller.getTheme);
router.patch('/theme', auth(), controller.updateTheme);
router.put('/theme', auth(), controller.updateTheme);
router.delete('/theme', auth(), controller.resetTheme);

router.get('/api-tokens', auth(), controller.listApiTokens);
router.post('/api-tokens', auth(), controller.createApiToken);
router.get('/api-tokens/:id', auth(), controller.getApiToken);
router.patch('/api-tokens/:id', auth(), controller.updateApiToken);
router.put('/api-tokens/:id', auth(), controller.updateApiToken);
router.delete('/api-tokens/:id', auth(), controller.deleteApiToken);

module.exports = router;
