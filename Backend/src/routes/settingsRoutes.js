const express = require('express');
const controller = require('../controllers/settingsController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/account', auth(), controller.getAccount);
router.patch('/account', auth(), controller.updateAccount);
router.get('/:section', auth(), controller.getSection);
router.patch('/:section', auth(), controller.updateSection);

module.exports = router;
