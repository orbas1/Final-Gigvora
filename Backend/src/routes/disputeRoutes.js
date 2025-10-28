const express = require('express');
const controller = require('../controllers/disputeController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(auth());

router.route('/').get(controller.list).post(controller.create);
router.get('/analytics', requireRole('admin'), controller.analytics);

router.route('/:id').get(controller.get).patch(controller.update).delete(controller.remove);

router.route('/:id/messages').get(controller.listMessages).post(controller.postMessage);
router
  .route('/:id/messages/:messageId')
  .get(controller.getMessage)
  .patch(controller.updateMessage)
  .delete(controller.deleteMessage);

router.route('/:id/evidence').get(controller.listEvidence).post(controller.postEvidence);
router
  .route('/:id/evidence/:evidenceId')
  .get(controller.getEvidence)
  .patch(controller.updateEvidence)
  .delete(controller.deleteEvidence);

router.get('/:id/settlements', controller.listSettlements);
router.post('/:id/settlements', controller.postSettlement);
router
  .route('/:id/settlements/:settlementId')
  .get(controller.getSettlement)
  .patch(controller.updateSettlement)
  .delete(controller.deleteSettlement);

router.get('/:id/decisions', controller.listDecisions);
router.get('/:id/decisions/:decisionId', controller.getDecision);
router.patch('/:id/decisions/:decisionId', requireRole('admin'), controller.updateDecision);
router.delete('/:id/decisions/:decisionId', requireRole('admin'), controller.deleteDecision);
router.post('/:id/decision', requireRole('admin'), controller.postDecision);

module.exports = router;
