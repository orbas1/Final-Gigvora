const express = require('express');
const { auth, requireRole } = require('../middleware/auth');
const walletController = require('../controllers/walletController');
const escrowController = require('../controllers/escrowController');
const payoutController = require('../controllers/payoutController');
const refundController = require('../controllers/refundController');
const ledgerController = require('../controllers/ledgerController');
const invoiceController = require('../controllers/invoiceController');
const analyticsController = require('../controllers/paymentAnalyticsController');
const webhookController = require('../controllers/paymentWebhookController');

const router = express.Router();

router.get('/wallet', auth(), walletController.getWallet);
router.get('/wallet/methods', auth(), walletController.listMethods);
router.post('/wallet/methods', auth(), walletController.createMethod);
router.get('/wallet/methods/:id', auth(), walletController.getMethod);
router.patch('/wallet/methods/:id', auth(), walletController.updateMethod);
router.delete('/wallet/methods/:id', auth(), walletController.deleteMethod);
router.get('/wallet/payout-accounts', auth(), walletController.listPayoutAccounts);
router.post('/wallet/payout-accounts', auth(), walletController.createPayoutAccount);
router.get('/wallet/payout-accounts/:id', auth(), walletController.getPayoutAccount);
router.patch('/wallet/payout-accounts/:id', auth(), walletController.updatePayoutAccount);
router.delete('/wallet/payout-accounts/:id', auth(), walletController.deletePayoutAccount);

router.get('/escrow', auth(), escrowController.list);
router.post('/escrow', auth(), escrowController.create);
router.get('/escrow/:id', auth(), escrowController.get);
router.post('/escrow/:id/capture', auth(), escrowController.capture);
router.post('/escrow/:id/cancel', auth(), escrowController.cancel);
router.post('/escrow/:id/refund', auth(), refundController.createForEscrow);
router.post('/escrow/:id/hold', auth(), escrowController.hold);
router.post('/escrow/:id/release', auth(), escrowController.release);

router.get('/payouts', auth(), payoutController.list);
router.post('/payouts', auth(), payoutController.create);
router.get('/payouts/:id', auth(), payoutController.get);
router.patch('/payouts/:id', auth(), requireRole('admin'), payoutController.update);
router.delete('/payouts/:id', auth(), requireRole('admin'), payoutController.remove);

router.get('/refunds', auth(), refundController.list);
router.post('/refunds', auth(), refundController.create);
router.get('/refunds/:id', auth(), refundController.get);
router.patch('/refunds/:id', auth(), requireRole('admin'), refundController.update);
router.delete('/refunds/:id', auth(), requireRole('admin'), refundController.remove);

router.get('/payments/ledger', auth(), ledgerController.list);
router.get('/invoices', auth(), invoiceController.list);
router.get('/invoices/:id', auth(), invoiceController.get);

router.get('/payments/analytics/gmv', auth(), requireRole('admin'), analyticsController.gmv);
router.get('/payments/analytics/take-rate', auth(), requireRole('admin'), analyticsController.takeRate);
router.get('/payments/analytics/disputes-rate', auth(), requireRole('admin'), analyticsController.disputesRate);

router.post('/payments/webhook', webhookController.process);

module.exports = router;
