const express = require('express');
const controller = require('../controllers/searchController');
const { auth } = require('../middleware/auth');
const { rateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.get('/', auth(false), rateLimiter, controller.search);
router.get('/suggestions', auth(false), rateLimiter, controller.suggestions);
router.get('/history', auth(), controller.history);
router.delete('/history/:id', auth(), controller.removeHistory);
router.post('/history/:id/restore', auth(), controller.restoreHistory);

module.exports = router;
