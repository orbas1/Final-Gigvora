const express = require('express');
const applicationController = require('../controllers/applicationController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/:id/scorecards', auth(), applicationController.listScorecards);
router.post('/:id/scorecards', auth(), applicationController.createScorecard);

router.post('/:id/move', auth(), applicationController.move);
router.post('/:id/tags', auth(), applicationController.addTags);
router.delete('/:id/tags', auth(), applicationController.removeTags);

router.get('/:id', auth(), applicationController.get);
router.patch('/:id', auth(), applicationController.update);
router.delete('/:id', auth(), applicationController.remove);

module.exports = router;
