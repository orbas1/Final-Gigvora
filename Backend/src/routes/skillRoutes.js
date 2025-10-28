const express = require('express');
const controller = require('../controllers/skillController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/suggest', auth(false), controller.suggest);
router.get('/', auth(false), controller.list);
router.post('/', auth(), requireRole('admin'), controller.create);
router.patch('/:id', auth(), requireRole('admin'), controller.update);
router.delete('/:id', auth(), requireRole('admin'), controller.remove);

module.exports = router;
