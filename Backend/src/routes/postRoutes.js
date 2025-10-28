const express = require('express');
const controller = require('../controllers/postController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/analytics/trending', auth(), controller.trending);
router.get('/', auth(), controller.list);
router.post('/', auth(), controller.create);
router.get('/:id/analytics', auth(), controller.analytics);
router.get('/:postId/comments', auth(), controller.listComments);
router.post('/:postId/comments', auth(), controller.createComment);
router.patch('/comments/:id', auth(), controller.updateComment);
router.delete('/comments/:id', auth(), controller.deleteComment);
router.get('/:id/reactions', auth(), controller.listReactions);
router.post('/:id/reactions', auth(), controller.addReaction);
router.delete('/:id/reactions', auth(), controller.removeReaction);
router.post('/:id/share', auth(), controller.share);
router.get('/:id', auth(), controller.get);
router.patch('/:id', auth(), controller.update);
router.delete('/:id', auth(), controller.remove);

module.exports = router;
