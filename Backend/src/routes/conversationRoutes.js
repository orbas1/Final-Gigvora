const express = require('express');
const controller = require('../controllers/conversationController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.use(auth());

router.get('/conversations', controller.listConversations);
router.post('/conversations', controller.createConversation);
router.get('/conversations/:conversationId', controller.getConversation);
router.patch('/conversations/:conversationId', controller.updateConversation);
router.delete('/conversations/:conversationId', controller.deleteConversation);

router.get('/messages/analytics/volume', controller.messageVolumeAnalytics);
router.get('/conversations/:conversationId/messages', controller.listMessages);
router.post('/conversations/:conversationId/messages', controller.createMessage);
router.patch('/messages/:messageId', controller.updateMessage);
router.delete('/messages/:messageId', controller.deleteMessage);
router.post('/messages/:messageId/read', controller.markMessageRead);

module.exports = router;
