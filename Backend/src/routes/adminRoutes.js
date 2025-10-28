const express = require('express');
const controller = require('../controllers/adminController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(auth(), requireRole('admin'));

router.get('/overview', controller.overview);

router.post('/users', controller.createUser);
router.get('/users', controller.users);
router.get('/users/:id', controller.getUser);
router.patch('/users/:id', controller.updateUser);
router.delete('/users/:id', controller.deleteUser);
router.post('/users/:id/impersonate', controller.impersonateUser);

router.post('/orgs', controller.createOrganization);
router.get('/orgs', controller.organizations);
router.get('/orgs/:id', controller.getOrganization);
router.patch('/orgs/:id', controller.updateOrganization);
router.delete('/orgs/:id', controller.deleteOrganization);

router.get('/reports', controller.reports);
router.post('/reports/:id/action', controller.reportAction);

router.get('/marketplace/config', controller.getMarketplaceConfig);
router.patch('/marketplace/config', controller.updateMarketplaceConfig);

router.post('/jobs', controller.createJob);
router.get('/jobs', controller.jobs);
router.get('/jobs/:id', controller.getJob);
router.patch('/jobs/:id', controller.updateJob);
router.delete('/jobs/:id', controller.deleteJob);

router.get('/payments/ledger', controller.paymentsLedger);
router.post('/payouts/:id/approve', controller.approvePayout);
router.post('/refunds/:id/approve', controller.approveRefund);

router.get('/disputes', controller.disputes);
router.post('/disputes/:id/decide', controller.decideDispute);

router.get('/moderation/strikes', controller.moderationStrikes);
router.post('/moderation/strikes', controller.createModerationStrike);
router.patch('/moderation/strikes/:id', controller.updateModerationStrike);
router.delete('/moderation/strikes/:id', controller.deleteModerationStrike);

router.get('/settings', controller.getSettings);
router.patch('/settings', controller.updateSettings);

router.get('/audit', controller.auditLogs);
router.get('/earnings', controller.earnings);

router.get('/analytics/kpis', controller.analyticsKpis);
router.get('/analytics/cohorts', controller.analyticsCohorts);
router.get('/analytics/search', controller.analyticsSearch);

router.post('/restore', controller.restore);

module.exports = router;
