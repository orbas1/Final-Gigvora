const express = require('express');
const controller = require('../controllers/legalController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/terms', controller.getTerms);
router.get('/privacy', controller.getPrivacy);
router.get('/refunds', controller.getRefunds);
router.get('/guidelines', controller.getGuidelines);
router.get('/consents', auth(), controller.listConsents);
router.post('/consents', auth(), controller.createConsent);
router.get('/consents/:id', auth(), controller.getConsent);

module.exports = router;
