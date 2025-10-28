const express = require('express');
const controller = require('../controllers/adminController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(auth(), requireRole('admin'));
router.get('/overview', controller.overview);
router.get('/users', controller.users);
router.post('/restore', controller.restore);

module.exports = router;
