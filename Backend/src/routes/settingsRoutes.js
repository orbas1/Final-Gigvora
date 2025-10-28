const express = require('express');
const controller = require('../controllers/settingsController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.use(auth());

router.get('/account', controller.getAccount);
router.patch('/account', controller.updateAccount);

router.get('/security', controller.getSecurity);
router.patch('/security', controller.updateSecurity);

router.get('/privacy', controller.getPrivacy);
router.patch('/privacy', controller.updatePrivacy);

router.get('/notifications', controller.getNotifications);
router.patch('/notifications', controller.updateNotifications);

router.get('/payments', controller.getPayments);
router.patch('/payments', controller.updatePayments);

router.get('/theme', controller.getTheme);
router.patch('/theme', controller.updateTheme);

router.get('/api-tokens', controller.listApiTokens);
router.post('/api-tokens', controller.createApiToken);
router.get('/api-tokens/:id', controller.getApiToken);
router.patch('/api-tokens/:id', controller.updateApiToken);
router.delete('/api-tokens/:id', controller.deleteApiToken);

module.exports = router;
