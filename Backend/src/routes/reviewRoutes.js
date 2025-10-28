const express = require('express');
const controller = require('../controllers/reviewController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth(false), controller.list);
router.post('/', auth(), controller.create);
router.get('/analytics/averages', auth(false), controller.averages);
router.delete('/:id', auth(), controller.remove);

module.exports = router;
