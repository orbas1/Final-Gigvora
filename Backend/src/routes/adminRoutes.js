const express = require('express');
const controller = require('../controllers/adminController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(auth(), requireRole('admin'));

router.get('/overview', controller.overview);

router.get('/users', controller.listUsers);
router.patch('/users/:id', controller.updateUser);
router.post('/users/:id/impersonate', controller.impersonateUser);

router.get('/orgs', controller.listOrgs);
router.patch('/orgs/:id', controller.updateOrg);

router.get('/reports', controller.listReports);
router.post('/reports/:id/action', controller.actOnReport);

router.route('/marketplace/config').get(controller.getMarketplaceConfig).patch(controller.updateMarketplaceConfig);

router.get('/jobs', controller.listJobs);
router.patch('/jobs/:id', controller.updateJob);

router.get('/payments/ledger', controller.listLedger);
router.post('/payouts/:id/approve', controller.approvePayout);
router.post('/refunds/:id/approve', controller.approveRefund);

router.get('/disputes', controller.listDisputes);
router.post('/disputes/:id/decide', controller.decideDispute);

router
  .route('/moderation/strikes')
  .get(controller.listStrikes)
  .post(controller.createStrike);
router.patch('/moderation/strikes/:id', controller.updateStrike);

router.route('/settings').get(controller.getSettings).patch(controller.updateSettings);

router.get('/audit', controller.listAuditLogs);

router.get('/earnings', controller.earnings);

router.get('/analytics/kpis', controller.analyticsKpis);
router.get('/analytics/cohorts', controller.analyticsCohorts);
router.get('/analytics/search', controller.analyticsSearch);

router.post('/restore', controller.restore);

module.exports = router;
