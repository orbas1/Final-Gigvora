const express = require('express');
const searchController = require('../controllers/searchController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth(false), searchController.search);
router.get('/suggestions', auth(false), searchController.suggestions);

module.exports = router;
