const express = require('express');
const controller = require('../controllers/companyController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth(false), controller.list);
router.post('/', auth(), controller.create);
router.get('/:id', auth(false), controller.getById);
router.patch('/:id', auth(), controller.update);
router.delete('/:id', auth(), controller.remove);
router.get('/:id/employees', auth(), controller.listEmployees);
router.post('/:id/employees', auth(), controller.addEmployee);
router.delete('/:id/employees/:userId', auth(), controller.removeEmployee);
router.get('/:id/analytics/profile', auth(), controller.analytics);

module.exports = router;
