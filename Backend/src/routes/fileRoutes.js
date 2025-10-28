const express = require('express');
const controller = require('../controllers/fileController');
const { auth } = require('../middleware/auth');

const router = express.Router();
const rawUpload = express.raw({ type: '*/*', limit: '50mb' });

router.get('/analytics/storage', auth(), controller.analytics);
router.get('/', auth(), controller.list);
router.post('/', auth(), controller.create);
router.put('/:id/content', rawUpload, controller.uploadContent);
router.get('/:id/content', controller.stream);
router.get('/:id', auth(), controller.get);
router.delete('/:id', auth(), controller.remove);

module.exports = router;
