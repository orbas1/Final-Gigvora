const express = require('express');
const controller = require('../controllers/postController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth(), controller.list);
router.post('/', auth(), controller.create);
router.get('/:id', auth(), controller.get);
router.patch('/:id', auth(), controller.update);
router.delete('/:id', auth(), controller.remove);
router.post('/:id/comments', auth(), controller.comment);
router.post('/:id/reactions', auth(), controller.react);
router.delete('/:id/reactions', auth(), controller.removeReaction);

module.exports = router;
