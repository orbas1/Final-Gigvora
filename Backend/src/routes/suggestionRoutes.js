const express = require('express');
const controller = require('../controllers/suggestionController');
const { auth } = require('../middleware/auth');
const { rateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.get('/explore', auth(), controller.explore);
router.get('/', auth(), controller.list);
router.post('/', auth(), controller.create);
router.get('/:id', auth(), controller.show);
router.patch('/:id', auth(), controller.update);
router.delete('/:id', auth(), controller.destroy);
router.post('/:id/restore', auth(), controller.restore);
router.post('/:id/events', auth(), rateLimiter, controller.recordEvent);
router.get('/:id/events', auth(), controller.listEvents);
router.get('/:id/analytics', auth(), controller.analytics);

module.exports = router;
