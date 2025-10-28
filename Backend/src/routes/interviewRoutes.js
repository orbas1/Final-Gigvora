const express = require('express');
const interviewController = require('../controllers/interviewController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth(), interviewController.list);
router.post('/', auth(), interviewController.create);
router.get('/:id', auth(), interviewController.get);
router.patch('/:id', auth(), interviewController.update);
router.delete('/:id', auth(), interviewController.remove);
router.post('/:id/feedback', auth(), interviewController.feedback);

module.exports = router;
