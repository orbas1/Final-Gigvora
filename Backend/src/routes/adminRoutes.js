const express = require('express');
const controller = require('../controllers/adminController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(auth(), requireRole('admin'));

router.get('/overview', controller.overview);

router.get('/users', controller.users);
router.patch('/users/:id', controller.updateUser);
router.post('/users/:id/impersonate', controller.impersonateUser);

router.get('/orgs', controller.organizations);
router.patch('/orgs/:id', controller.updateOrganization);

router.get('/reports', controller.reports);
router.post('/reports/:id/action', controller.reportAction);

router.get('/marketplace/config', controller.getMarketplaceConfig);
router.patch('/marketplace/config', controller.updateMarketplaceConfig);

router.get('/jobs', controller.jobs);
router.patch('/jobs/:id', controller.updateJob);

router.get('/payments/ledger', controller.paymentsLedger);
router.post('/payouts/:id/approve', controller.approvePayout);
router.post('/refunds/:id/approve', controller.approveRefund);

router.get('/disputes', controller.disputes);
router.post('/disputes/:id/decide', controller.decideDispute);

router.get('/moderation/strikes', controller.moderationStrikes);
router.post('/moderation/strikes', controller.createModerationStrike);
router.patch('/moderation/strikes/:id', controller.updateModerationStrike);

router.get('/settings', controller.getSettings);
router.patch('/settings', controller.updateSettings);

router.get('/audit', controller.auditLogs);
router.get('/earnings', controller.earnings);

router.get('/analytics/kpis', controller.analyticsKpis);
router.get('/analytics/cohorts', controller.analyticsCohorts);
router.get('/analytics/search', controller.analyticsSearch);

router.post('/restore', controller.restore);

module.exports = router;
