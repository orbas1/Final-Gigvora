const express = require('express');
const controller = require('../controllers/gigController');
const analyticsController = require('../controllers/marketplaceAnalyticsController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth(false), controller.list);
router.post('/', auth(), controller.create);
router.get('/analytics/sales', auth(), requireRole('admin'), analyticsController.gigSales);
router.get('/:id', auth(false), controller.get);
router.patch('/:id', auth(), controller.update);
router.delete('/:id', auth(), controller.remove);

router.get('/:id/packages', auth(), controller.listPackages);
router.post('/:id/packages', auth(), controller.createPackages);
router.patch('/packages/:id', auth(), controller.updatePackage);
router.delete('/packages/:id', auth(), controller.deletePackage);

router.get('/:id/addons', auth(), controller.listAddons);
router.post('/:id/addons', auth(), controller.createAddon);
router.patch('/addons/:id', auth(), controller.updateAddon);
router.delete('/addons/:id', auth(), controller.deleteAddon);

router.get('/:id/faq', auth(), controller.listFaq);
router.post('/:id/faq', auth(), controller.createFaq);
router.patch('/faq/:id', auth(), controller.updateFaq);
router.delete('/faq/:id', auth(), controller.deleteFaq);

router.post('/:id/media', auth(), controller.addMedia);
router.delete('/:id/media/:mediaId', auth(), controller.removeMedia);

router.get('/:id/orders', auth(), controller.listOrders);
router.post('/:id/orders', auth(), controller.createOrder);

router.get('/:id/analytics', auth(), controller.gigAnalytics);

module.exports = router;
