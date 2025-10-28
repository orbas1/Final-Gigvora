const express = require('express');
const controller = require('../controllers/webhookController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth(), controller.list);
router.post('/', auth(), controller.create);
router.delete('/:id', auth(), controller.remove);
router.get('/deliveries', auth(), controller.deliveries);

module.exports = router;
