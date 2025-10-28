const express = require('express');
const controller = require('../controllers/agencyController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth(false), controller.list);
router.post('/', auth(), controller.create);
router.get('/:id', auth(false), controller.getById);
router.patch('/:id', auth(), controller.update);
router.delete('/:id', auth(), controller.remove);
router.get('/:id/team', auth(), controller.listTeam);
router.post('/:id/team', auth(), controller.addTeamMember);
router.delete('/:id/team/:userId', auth(), controller.removeTeamMember);
router.get('/:id/analytics/profile', auth(), controller.analytics);

module.exports = router;
