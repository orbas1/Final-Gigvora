const express = require('express');
const controller = require('../controllers/groupController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth(false), controller.list);
router.post('/', auth(), controller.create);
router.get('/:id', auth(false), controller.get);
router.patch('/:id', auth(), controller.update);
router.delete('/:id', auth(), controller.remove);
router.post('/:id/join', auth(), controller.join);
router.post('/:id/leave', auth(), controller.leave);
router.get('/:id/members', auth(false), controller.members);
router.patch('/:id/members/:userId', auth(), controller.updateMember);
router.get('/:id/analytics', auth(), controller.analytics);

module.exports = router;
