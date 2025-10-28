const express = require('express');
const { auth } = require('../middleware/auth');
const postController = require('../controllers/postController');

const router = express.Router();

router.get('/analytics/health', auth(), postController.feedHealth);

module.exports = router;
