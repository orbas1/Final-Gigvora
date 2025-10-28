const express = require('express');
const scorecardController = require('../controllers/scorecardController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.patch('/:scorecardId', auth(), scorecardController.update);
router.delete('/:scorecardId', auth(), scorecardController.remove);

module.exports = router;
