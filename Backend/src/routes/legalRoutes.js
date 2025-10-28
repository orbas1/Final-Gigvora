const express = require('express');
const controller = require('../controllers/legalController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/terms', auth(false), controller.getTerms);
router.get('/privacy', auth(false), controller.getPrivacy);
router.get('/refunds', auth(false), controller.getRefunds);
router.get('/guidelines', auth(false), controller.getGuidelines);
router.get('/documents', auth(), requireRole('admin'), controller.listDocuments);
router.post('/documents', auth(), requireRole('admin'), controller.createDocument);
router.patch('/documents/:id', auth(), requireRole('admin'), controller.updateDocument);
router.delete('/documents/:id', auth(), requireRole('admin'), controller.deleteDocument);

router.get('/consents', auth(), controller.listConsents);
router.post('/consents', auth(), controller.createConsent);
router.get('/consents/:id', auth(), controller.getConsent);
router.patch('/consents/:id', auth(), controller.updateConsent);
router.delete('/consents/:id', auth(), controller.deleteConsent);

module.exports = router;
