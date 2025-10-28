const express = require('express');
const controller = require('../controllers/connectionController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth(), controller.list);
router.post('/request', auth(), controller.request);
router.post('/accept', auth(), controller.accept);
router.post('/reject', auth(), controller.reject);
router.delete('/:id', auth(), controller.remove);
router.get('/analytics/network-growth', auth(), controller.analytics);

module.exports = router;
