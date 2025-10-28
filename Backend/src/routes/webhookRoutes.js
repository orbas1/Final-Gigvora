const express = require('express');
const controller = require('../controllers/webhookController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth(), controller.list);
router.post('/', auth(), controller.create);
router.get('/deliveries', auth(), controller.deliveries);
router.get('/:id', auth(), controller.get);
router.patch('/:id', auth(), controller.update);
router.post('/:id/rotate-secret', auth(), controller.rotateSecret);
router.delete('/:id', auth(), controller.remove);

module.exports = router;
