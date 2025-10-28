const express = require('express');
const gigController = require('../controllers/gigController');

const router = express.Router();

router.get('/analytics/sales', gigController.salesAnalytics);
router.get('/:id/analytics', gigController.gigAnalytics);

router.get('/', gigController.listGigs);
router.post('/', gigController.createGig);
router.get('/:id', gigController.getGig);
router.patch('/:id', gigController.updateGig);
router.delete('/:id', gigController.deleteGig);

router.get('/:id/packages', gigController.listPackages);
router.post('/:id/packages', gigController.createPackage);
router.patch('/packages/:packageId', gigController.updatePackage);
router.delete('/packages/:packageId', gigController.deletePackage);

router.get('/:id/addons', gigController.listAddons);
router.post('/:id/addons', gigController.createAddon);
router.patch('/addons/:addonId', gigController.updateAddon);
router.delete('/addons/:addonId', gigController.deleteAddon);

router.get('/:id/faq', gigController.listFaqs);
router.post('/:id/faq', gigController.createFaq);
router.patch('/faq/:faqId', gigController.updateFaq);
router.delete('/faq/:faqId', gigController.deleteFaq);

router.post('/:id/media', gigController.addMedia);
router.delete('/:id/media/:mediaId', gigController.removeMedia);

router.get('/:id/orders', gigController.listOrders);
router.post('/:id/orders', gigController.createOrder);
router.get('/orders/:orderId', gigController.getOrder);
router.patch('/orders/:orderId', gigController.updateOrder);
router.post('/orders/:orderId/cancel', gigController.cancelOrder);

router.get('/orders/:orderId/submissions', gigController.listSubmissions);
router.post('/orders/:orderId/submissions', gigController.createSubmission);
router.patch('/submissions/:submissionId', gigController.updateSubmission);

router.get('/orders/:orderId/reviews', gigController.listOrderReviews);
router.post('/orders/:orderId/reviews', gigController.createOrderReview);

module.exports = router;
