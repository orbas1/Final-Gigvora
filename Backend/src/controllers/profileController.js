const Joi = require('joi');
const profileService = require('../services/profileService');
const { ApiError } = require('../middleware/errorHandler');

const toBoolean = (value) => value === true || value === 'true' || value === '1';

const parseExpand = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((entry) => String(entry).split(',').map((token) => token.trim()).filter(Boolean));
  }
  return String(value)
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
};

const parseListOptions = (req) => ({
  limit: req.query.limit,
  cursor: req.query.cursor,
  sort: req.query.sort,
  analytics: toBoolean(req.query.analytics),
  includeDeleted: req.query.include === 'deleted' && req.user?.role === 'admin',
});

const ensureOwnerOrAdmin = (req) => {
  if (req.user?.role === 'admin') return;
  if (req.user?.id !== req.params.userId) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }
};

const ensureAdminOrOrgMember = (req, orgId) => {
  if (req.user?.role === 'admin') return;
  if (req.user?.org_id === orgId) return;
  throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
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

const experienceCreateSchema = Joi.object({
  title: Joi.string().required(),
  company: Joi.string().required(),
  start_date: Joi.date().required(),
  end_date: Joi.date().optional(),
  is_current: Joi.boolean().optional(),
  description: Joi.string().optional(),
});

const experienceUpdateSchema = experienceCreateSchema.fork(['title', 'company', 'start_date'], (schema) => schema.optional());

const educationCreateSchema = Joi.object({
  school: Joi.string().required(),
  degree: Joi.string().optional(),
  field: Joi.string().optional(),
  start_date: Joi.date().optional(),
  end_date: Joi.date().optional(),
  description: Joi.string().optional(),
});

const educationUpdateSchema = educationCreateSchema.fork(['school'], (schema) => schema.optional());

const skillEntry = Joi.alternatives().try(
  Joi.string().min(1),
  Joi.object({ name: Joi.string().min(1).required(), proficiency: Joi.string().allow(null, '') })
);
const skillSchema = Joi.object({ skills: Joi.array().items(skillEntry).min(1).required() });
const skillDeleteSchema = Joi.object({ skills: Joi.array().items(Joi.string().min(1)).optional() });

const tagEntry = Joi.alternatives().try(Joi.string().min(1), Joi.object({ name: Joi.string().min(1).required() }));
const tagSchema = Joi.object({ tags: Joi.array().items(tagEntry).min(1).required() });
const tagDeleteSchema = Joi.object({ tags: Joi.array().items(Joi.string().min(1)).optional() });

const portfolioCreateSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().optional(),
  url: Joi.string().uri().optional(),
  media: Joi.object().optional(),
});
const portfolioUpdateSchema = portfolioCreateSchema.fork(['title'], (schema) => schema.optional());

const reviewSchema = Joi.object({
  reviewer_id: Joi.string().uuid().required(),
  rating: Joi.number().min(1).max(5).required(),
  comment: Joi.string().optional(),
  metadata: Joi.object().optional(),
});

const freelancerSchema = Joi.object({
  headline: Joi.string().allow('', null),
  specialties: Joi.array().items(Joi.string()).optional(),
  availability_status: Joi.string().valid('available', 'limited', 'unavailable').optional(),
  available_hours_per_week: Joi.number().integer().min(0).optional(),
  languages: Joi.array().items(Joi.string()).optional(),
  rate_card: Joi.object().optional(),
  certifications: Joi.array().items(Joi.string()).optional(),
  verified_at: Joi.date().optional().allow(null),
});

const agencySchema = Joi.object({
  name: Joi.string().optional(),
  overview: Joi.string().optional(),
  website: Joi.string().uri().optional(),
  timezone: Joi.string().optional(),
  social_links: Joi.object().optional(),
  rate_card: Joi.object().optional(),
  metrics_snapshot: Joi.object().optional(),
  owner_user_id: Joi.string().uuid().optional().allow(null),
});

const companySchema = Joi.object({
  legal_name: Joi.string().optional(),
  brand_name: Joi.string().optional(),
  overview: Joi.string().optional(),
  website: Joi.string().uri().optional(),
  industry: Joi.string().optional(),
  team_size: Joi.number().integer().min(0).optional(),
  headquarters: Joi.string().optional(),
  hiring_needs: Joi.object().optional(),
  benefits: Joi.object().optional(),
  owner_user_id: Joi.string().uuid().optional().allow(null),
});

const recordViewSchema = Joi.object({
  source: Joi.string().max(255).allow(null, ''),
  viewer_id: Joi.string().uuid().allow(null),
});

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', { errors: error.details });
  }
  return value;
};

const getProfile = async (req, res, next) => {
  try {
    const expand = parseExpand(req.query.expand);
    const includeDeleted = req.query.include === 'deleted' && req.user?.role === 'admin';
    const profile = await profileService.getProfile(req.params.userId, { includeDeleted, expand });
    res.json(profile);
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    ensureOwnerOrAdmin(req);
    const payload = validate(profileSchema, req.body);
    const profile = await profileService.updateProfile(req.params.userId, payload);
    res.json(profile);
  } catch (error) {
    next(error);
  }
};

const listExperiences = async (req, res, next) => {
  try {
    const result = await profileService.listExperiences(req.params.userId, parseListOptions(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getExperience = async (req, res, next) => {
  try {
    const includeDeleted = req.query.include === 'deleted' && req.user?.role === 'admin';
    const experience = await profileService.getExperience(req.params.userId, req.params.expId, { includeDeleted });
    res.json(experience);
  } catch (error) {
    next(error);
  }
};

const createExperience = async (req, res, next) => {
  try {
    ensureOwnerOrAdmin(req);
    const payload = validate(experienceCreateSchema, req.body);
    const experience = await profileService.createExperience(req.params.userId, payload);
    res.status(201).json(experience);
  } catch (error) {
    next(error);
  }
};

const updateExperience = async (req, res, next) => {
  try {
    ensureOwnerOrAdmin(req);
    const payload = validate(experienceUpdateSchema, req.body);
    const experience = await profileService.updateExperience(req.params.userId, req.params.expId, payload);
    res.json(experience);
  } catch (error) {
    next(error);
  }
};

const deleteExperience = async (req, res, next) => {
  try {
    ensureOwnerOrAdmin(req);
    const result = await profileService.deleteExperience(req.params.userId, req.params.expId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const listEducation = async (req, res, next) => {
  try {
    const result = await profileService.listEducation(req.params.userId, parseListOptions(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getEducation = async (req, res, next) => {
  try {
    const includeDeleted = req.query.include === 'deleted' && req.user?.role === 'admin';
    const education = await profileService.getEducation(req.params.userId, req.params.eduId, { includeDeleted });
    res.json(education);
  } catch (error) {
    next(error);
  }
};

const createEducation = async (req, res, next) => {
  try {
    ensureOwnerOrAdmin(req);
    const payload = validate(educationCreateSchema, req.body);
    const education = await profileService.createEducation(req.params.userId, payload);
    res.status(201).json(education);
  } catch (error) {
    next(error);
  }
};

const updateEducation = async (req, res, next) => {
  try {
    ensureOwnerOrAdmin(req);
    const payload = validate(educationUpdateSchema, req.body);
    const education = await profileService.updateEducation(req.params.userId, req.params.eduId, payload);
    res.json(education);
  } catch (error) {
    next(error);
  }
};

const deleteEducation = async (req, res, next) => {
  try {
    ensureOwnerOrAdmin(req);
    const result = await profileService.deleteEducation(req.params.userId, req.params.eduId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const listSkills = async (req, res, next) => {
  try {
    const analytics = toBoolean(req.query.analytics);
    const result = await profileService.listSkills(req.params.userId, { analytics });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const upsertSkills = async (req, res, next) => {
  try {
    ensureOwnerOrAdmin(req);
    const payload = validate(skillSchema, req.body);
    const result = await profileService.upsertSkills(req.params.userId, payload.skills);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const deleteSkills = async (req, res, next) => {
  try {
    ensureOwnerOrAdmin(req);
    const payload = validate(skillDeleteSchema, req.body || {});
    const identifiers = payload.skills || [];
    const result = await profileService.deleteSkills(req.params.userId, identifiers);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const listTags = async (req, res, next) => {
  try {
    const analytics = toBoolean(req.query.analytics);
    const result = await profileService.listTags(req.params.userId, { analytics });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const upsertTags = async (req, res, next) => {
  try {
    ensureOwnerOrAdmin(req);
    const payload = validate(tagSchema, req.body);
    const result = await profileService.upsertTags(req.params.userId, payload.tags);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const deleteTags = async (req, res, next) => {
  try {
    ensureOwnerOrAdmin(req);
    const payload = validate(tagDeleteSchema, req.body || {});
    const identifiers = payload.tags || [];
    const result = await profileService.deleteTags(req.params.userId, identifiers);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const listPortfolio = async (req, res, next) => {
  try {
    const result = await profileService.listPortfolio(req.params.userId, parseListOptions(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const createPortfolio = async (req, res, next) => {
  try {
    ensureOwnerOrAdmin(req);
    const payload = validate(portfolioCreateSchema, req.body);
    const item = await profileService.addPortfolioItem(req.params.userId, payload);
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
};

const updatePortfolio = async (req, res, next) => {
  try {
    ensureOwnerOrAdmin(req);
    const payload = validate(portfolioUpdateSchema, req.body);
    const item = await profileService.updatePortfolioItem(req.params.userId, req.params.itemId, payload);
    res.json(item);
  } catch (error) {
    next(error);
  }
};

const deletePortfolio = async (req, res, next) => {
  try {
    ensureOwnerOrAdmin(req);
    const result = await profileService.deletePortfolioItem(req.params.userId, req.params.itemId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const listReviews = async (req, res, next) => {
  try {
    const result = await profileService.listReviews(req.params.userId, parseListOptions(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const addReview = async (req, res, next) => {
  try {
    const payload = validate(reviewSchema, req.body);
    const reviewerId =
      req.user?.role === 'admin'
        ? payload.reviewer_id
        : req.user?.id;

    if (!reviewerId) {
      throw new ApiError(403, 'Authentication required to review', 'AUTH_REQUIRED');
    }

    if (req.user?.role !== 'admin' && payload.reviewer_id && payload.reviewer_id !== reviewerId) {
      throw new ApiError(403, 'Reviewer mismatch', 'FORBIDDEN');
    }

    const review = await profileService.addReview(
      req.params.userId,
      { ...payload, reviewer_id: reviewerId },
      { actor: req.user }
    );
    res.status(201).json(review);
  } catch (error) {
    next(error);
  }
};

const recordView = async (req, res, next) => {
  try {
    const payload = validate(recordViewSchema, req.body || {});

    if (payload.viewer_id && req.user?.role !== 'admin') {
      throw new ApiError(403, 'Only admins may override the viewer', 'FORBIDDEN');
    }

    const view = await profileService.recordProfileView({
      profileId: req.params.userId,
      viewerId: payload.viewer_id ?? req.user?.id ?? null,
      source: payload.source || undefined,
    });

    res.status(201).json(view);
  } catch (error) {
    next(error);
  }
};

const trafficAnalytics = async (req, res, next) => {
  try {
    const result = await profileService.trafficAnalytics({
      id: req.params.id,
      from: req.query.from,
      to: req.query.to,
      by: req.query.by,
    });
    res.json({ buckets: result });
  } catch (error) {
    next(error);
  }
};

const engagementAnalytics = async (req, res, next) => {
  try {
    const result = await profileService.engagementAnalytics({
      id: req.params.id,
      from: req.query.from,
      to: req.query.to,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const topProfiles = async (req, res, next) => {
  try {
    const result = await profileService.topProfiles({
      metric: req.query.metric,
      from: req.query.from,
      to: req.query.to,
      limit: req.query.limit,
    });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

const getFreelancerOverlay = async (req, res, next) => {
  try {
    const includeDeleted = req.query.include === 'deleted' && req.user?.role === 'admin';
    const overlay = await profileService.getFreelancerOverlay(req.params.userId, { includeDeleted });
    res.json(overlay);
  } catch (error) {
    next(error);
  }
};

const updateFreelancerOverlay = async (req, res, next) => {
  try {
    ensureOwnerOrAdmin(req);
    const payload = validate(freelancerSchema, req.body);
    const overlay = await profileService.updateFreelancerOverlay(req.params.userId, payload);
    res.json(overlay);
  } catch (error) {
    next(error);
  }
};

const getAgencyOverlay = async (req, res, next) => {
  try {
    const includeDeleted = req.query.include === 'deleted' && req.user?.role === 'admin';
    const overlay = await profileService.getAgencyOverlay(req.params.orgId, { includeDeleted });
    res.json(overlay);
  } catch (error) {
    next(error);
  }
};

const updateAgencyOverlay = async (req, res, next) => {
  try {
    ensureAdminOrOrgMember(req, req.params.orgId);
    const payload = validate(agencySchema, req.body);
    const overlay = await profileService.updateAgencyOverlay(req.params.orgId, payload);
    res.json(overlay);
  } catch (error) {
    next(error);
  }
};

const getCompanyOverlay = async (req, res, next) => {
  try {
    const includeDeleted = req.query.include === 'deleted' && req.user?.role === 'admin';
    const overlay = await profileService.getCompanyOverlay(req.params.orgId, { includeDeleted });
    res.json(overlay);
  } catch (error) {
    next(error);
  }
};

const updateCompanyOverlay = async (req, res, next) => {
  try {
    ensureAdminOrOrgMember(req, req.params.orgId);
    const payload = validate(companySchema, req.body);
    const overlay = await profileService.updateCompanyOverlay(req.params.orgId, payload);
    res.json(overlay);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  listExperiences,
  getExperience,
  createExperience,
  updateExperience,
  deleteExperience,
  listEducation,
  getEducation,
  createEducation,
  updateEducation,
  deleteEducation,
  listSkills,
  upsertSkills,
  deleteSkills,
  listTags,
  upsertTags,
  deleteTags,
  listPortfolio,
  createPortfolio,
  updatePortfolio,
  deletePortfolio,
  listReviews,
  addReview,
  recordView,
  trafficAnalytics,
  engagementAnalytics,
  topProfiles,
  getFreelancerOverlay,
  updateFreelancerOverlay,
  getAgencyOverlay,
  updateAgencyOverlay,
  getCompanyOverlay,
  updateCompanyOverlay,
};
