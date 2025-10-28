const Joi = require('joi');
const profileService = require('../services/profileService');
const { ApiError } = require('../middleware/errorHandler');

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', { errors: error.details });
  }
  return value;
};

const profileSchema = Joi.object({
  display_name: Joi.string(),
  headline: Joi.string(),
  bio: Joi.string(),
  location: Joi.string(),
  socials: Joi.object(),
  hourly_rate: Joi.number(),
  currency: Joi.string(),
  visibility: Joi.string().valid('public', 'private', 'connections'),
});

const experienceSchema = Joi.object({
  title: Joi.string().required(),
  company: Joi.string().required(),
  start_date: Joi.date().required(),
  end_date: Joi.date().optional(),
  is_current: Joi.boolean().optional(),
  description: Joi.string().optional(),
});

const educationSchema = Joi.object({
  school: Joi.string().required(),
  degree: Joi.string().optional(),
  field: Joi.string().optional(),
  start_date: Joi.date().optional(),
  end_date: Joi.date().optional(),
  description: Joi.string().optional(),
});

const skillSchema = Joi.object({ skills: Joi.array().items(Joi.string()).required() });
const tagSchema = Joi.object({ tags: Joi.array().items(Joi.string()).required() });
const portfolioSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().optional(),
  url: Joi.string().uri().optional(),
  media: Joi.object().optional(),
});
const reviewSchema = Joi.object({
  rating: Joi.number().min(1).max(5).required(),
  comment: Joi.string().allow('', null),
});

const reviewQuerySchema = Joi.object({
  cursor: Joi.string(),
  limit: Joi.number().integer().min(1).max(100),
  sort: Joi.string(),
  q: Joi.string(),
  fields: Joi.string(),
  expand: Joi.string(),
  include: Joi.string().valid('deleted'),
  analytics: Joi.boolean().truthy('true', '1', 'yes').falsy('false', '0', 'no'),
});

const getProfile = async (req, res, next) => {
  try {
    const profile = await profileService.getProfile(req.params.userId);
    res.json(profile);
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const payload = validate(profileSchema, req.body);
    if (req.user.id !== req.params.userId && req.user.role !== 'admin') {
      throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
    }
    const profile = await profileService.updateProfile(req.params.userId, payload);
    res.json(profile);
  } catch (error) {
    next(error);
  }
};

const createExperience = async (req, res, next) => {
  try {
    const payload = validate(experienceSchema, req.body);
    const experience = await profileService.addExperience(req.params.userId, payload);
    res.status(201).json(experience);
  } catch (error) {
    next(error);
  }
};

const updateExperience = async (req, res, next) => {
  try {
    const payload = validate(experienceSchema, req.body);
    const experience = await profileService.updateExperience(req.params.userId, req.params.expId, payload);
    res.json(experience);
  } catch (error) {
    next(error);
  }
};

const deleteExperience = async (req, res, next) => {
  try {
    const result = await profileService.deleteExperience(req.params.expId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const createEducation = async (req, res, next) => {
  try {
    const payload = validate(educationSchema, req.body);
    const education = await profileService.addEducation(req.params.userId, payload);
    res.status(201).json(education);
  } catch (error) {
    next(error);
  }
};

const updateEducation = async (req, res, next) => {
  try {
    const payload = validate(educationSchema, req.body);
    const education = await profileService.updateEducation(req.params.userId, req.params.eduId, payload);
    res.json(education);
  } catch (error) {
    next(error);
  }
};

const deleteEducation = async (req, res, next) => {
  try {
    const result = await profileService.deleteEducation(req.params.eduId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const upsertSkills = async (req, res, next) => {
  try {
    const payload = validate(skillSchema, req.body);
    const result = await profileService.upsertSkills(req.params.userId, payload.skills);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

const deleteSkill = async (req, res, next) => {
  try {
    const result = await profileService.removeSkill(req.params.userId, req.params.skillId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const upsertTags = async (req, res, next) => {
  try {
    const payload = validate(tagSchema, req.body);
    const result = await profileService.upsertTags(req.params.userId, payload.tags);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

const deleteTag = async (req, res, next) => {
  try {
    const result = await profileService.removeTag(req.params.userId, req.params.tagId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const createPortfolio = async (req, res, next) => {
  try {
    const payload = validate(portfolioSchema, req.body);
    const item = await profileService.addPortfolioItem(req.params.userId, payload);
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
};

const updatePortfolio = async (req, res, next) => {
  try {
    const payload = validate(portfolioSchema, req.body);
    const item = await profileService.updatePortfolioItem(req.params.userId, req.params.itemId, payload);
    res.json(item);
  } catch (error) {
    next(error);
  }
};

const deletePortfolio = async (req, res, next) => {
  try {
    const result = await profileService.deletePortfolioItem(req.params.itemId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const addReview = async (req, res, next) => {
  try {
    const payload = validate(reviewSchema, req.body);
    const review = await profileService.addReview(req.params.userId, req.user, payload);
    res.status(201).json(review);
  } catch (error) {
    next(error);
  }
};

const listReviews = async (req, res, next) => {
  try {
    const query = validate(reviewQuerySchema, req.query);
    const result = await profileService.listReviews(req.params.userId, query, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const trafficAnalytics = async (req, res, next) => {
  try {
    const result = await profileService.trafficAnalytics({ id: req.params.id, ...req.query });
    res.json({ buckets: result });
  } catch (error) {
    next(error);
  }
};

const engagementAnalytics = async (req, res, next) => {
  try {
    const result = await profileService.engagementAnalytics({ id: req.params.id });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const topProfiles = async (req, res, next) => {
  try {
    const result = await profileService.topProfiles(req.query);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  createExperience,
  updateExperience,
  deleteExperience,
  createEducation,
  updateEducation,
  deleteEducation,
  upsertSkills,
  deleteSkill,
  upsertTags,
  deleteTag,
  createPortfolio,
  updatePortfolio,
  deletePortfolio,
  addReview,
  listReviews,
  trafficAnalytics,
  engagementAnalytics,
  topProfiles,
};
