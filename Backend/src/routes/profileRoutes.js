const express = require('express');
const controller = require('../controllers/profileController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/analytics/top', auth(), controller.topProfiles);
router.get('/:id/analytics/traffic', auth(), controller.trafficAnalytics);
router.get('/:id/analytics/engagement', auth(), controller.engagementAnalytics);

router.get('/:userId/reviews', auth(false), controller.listReviews);
router.post('/:userId/reviews', auth(), controller.addReview);

router.get('/:userId', auth(), controller.getProfile);
router.patch('/:userId', auth(), controller.updateProfile);
router.post('/:userId/experience', auth(), controller.createExperience);
router.get('/:userId/experience', auth(), controller.getProfile);
router.patch('/:userId/experience/:expId', auth(), controller.updateExperience);
router.delete('/:userId/experience/:expId', auth(), controller.deleteExperience);
router.post('/:userId/education', auth(), controller.createEducation);
router.patch('/:userId/education/:eduId', auth(), controller.updateEducation);
router.delete('/:userId/education/:eduId', auth(), controller.deleteEducation);
router.post('/:userId/skills', auth(), controller.upsertSkills);
router.delete('/:userId/skills/:skillId', auth(), controller.deleteSkill);
router.post('/:userId/tags', auth(), controller.upsertTags);
router.delete('/:userId/tags/:tagId', auth(), controller.deleteTag);
router.post('/:userId/portfolio', auth(), controller.createPortfolio);
router.patch('/:userId/portfolio/:itemId', auth(), controller.updatePortfolio);
router.delete('/:userId/portfolio/:itemId', auth(), controller.deletePortfolio);

module.exports = router;
