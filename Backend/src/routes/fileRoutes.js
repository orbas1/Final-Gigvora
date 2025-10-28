const express = require('express');
const controller = require('../controllers/fileController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.post('/', auth(), controller.create);
router.get('/:id', auth(), controller.get);
router.delete('/:id', auth(), controller.remove);
router.get('/analytics/storage', auth(), controller.analytics);

module.exports = router;
