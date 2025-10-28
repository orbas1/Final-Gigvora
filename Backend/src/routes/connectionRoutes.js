const express = require('express');
const controller = require('../controllers/connectionController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/analytics/network-growth', auth(), controller.analytics);
router.get('/', auth(), controller.list);
router.get('/:id', auth(), controller.show);
router.post('/request', auth(), controller.request);
router.post('/accept', auth(), controller.accept);
router.post('/reject', auth(), controller.reject);
router.patch('/:id', auth(), controller.update);
router.delete('/:id', auth(), controller.remove);

module.exports = router;
