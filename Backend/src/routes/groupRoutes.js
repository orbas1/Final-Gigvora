'use strict';

const express = require('express');
const controller = require('../controllers/groupController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth(false), controller.list);
router.get('/analytics/summary', auth(), requireRole('admin'), controller.analytics);
router.get('/:id', auth(false), controller.get);
router.post('/', auth(), controller.create);
router.patch('/:id', auth(), controller.update);
router.delete('/:id', auth(), controller.remove);

module.exports = router;
