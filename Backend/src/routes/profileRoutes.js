const express = require('express');
const controller = require('../controllers/profileController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/analytics/top', auth(), controller.topProfiles);

router.get('/agency/:orgId', auth(), controller.getAgencyOverlay);
router.patch('/agency/:orgId', auth(), controller.updateAgencyOverlay);

router.get('/company/:orgId', auth(), controller.getCompanyOverlay);
router.patch('/company/:orgId', auth(), controller.updateCompanyOverlay);

router.get('/:id/analytics/traffic', auth(), controller.trafficAnalytics);
router.get('/:id/analytics/engagement', auth(), controller.engagementAnalytics);

router.get('/:userId/freelancer', auth(), controller.getFreelancerOverlay);
router.patch('/:userId/freelancer', auth(), controller.updateFreelancerOverlay);

router.post('/:userId/views', auth(false), controller.recordView);

router.get('/:userId', auth(), controller.getProfile);
router.patch('/:userId', auth(), controller.updateProfile);

router.get('/:userId/experience', auth(), controller.listExperiences);
router.post('/:userId/experience', auth(), controller.createExperience);
router.get('/:userId/experience/:expId', auth(), controller.getExperience);
router.patch('/:userId/experience/:expId', auth(), controller.updateExperience);
router.delete('/:userId/experience/:expId', auth(), controller.deleteExperience);

router.get('/:userId/education', auth(), controller.listEducation);
router.post('/:userId/education', auth(), controller.createEducation);
router.get('/:userId/education/:eduId', auth(), controller.getEducation);
router.patch('/:userId/education/:eduId', auth(), controller.updateEducation);
router.delete('/:userId/education/:eduId', auth(), controller.deleteEducation);

router.get('/:userId/skills', auth(), controller.listSkills);
router.post('/:userId/skills', auth(), controller.upsertSkills);
router.delete('/:userId/skills', auth(), controller.deleteSkills);

router.get('/:userId/tags', auth(), controller.listTags);
router.post('/:userId/tags', auth(), controller.upsertTags);
router.delete('/:userId/tags', auth(), controller.deleteTags);

router.get('/:userId/portfolio', auth(), controller.listPortfolio);
router.post('/:userId/portfolio', auth(), controller.createPortfolio);
router.patch('/:userId/portfolio/:itemId', auth(), controller.updatePortfolio);
router.delete('/:userId/portfolio/:itemId', auth(), controller.deletePortfolio);

router.get('/:userId/reviews', auth(), controller.listReviews);
router.post('/:userId/reviews', auth(), controller.addReview);

module.exports = router;
