const express = require('express');
const networkingController = require('../controllers/networkingController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/lobbies', auth(false), networkingController.listLobbies);
router.get('/lobbies/:id', auth(false), networkingController.getLobby);
router.post('/lobbies', auth(), requireRole('admin'), networkingController.createLobby);
router.put('/lobbies/:id', auth(), requireRole('admin'), networkingController.updateLobby);
router.delete('/lobbies/:id', auth(), requireRole('admin'), networkingController.deleteLobby);

router.post('/sessions', auth(), networkingController.joinSession);
router.get('/sessions/:id', auth(), networkingController.getSession);
router.post('/sessions/:id/leave', auth(), networkingController.leaveSession);
router.post('/sessions/:id/rate', auth(), networkingController.rateSession);

router.get('/analytics/usage', auth(), requireRole('admin'), networkingController.analyticsUsage);

module.exports = router;
