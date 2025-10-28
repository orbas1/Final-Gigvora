const Joi = require('joi');
const applicationService = require('../services/applicationService');
const { persistIdempotentResponse } = require('../middleware/idempotency');

const listSchema = Joi.object({
  stage: Joi.string().uuid(),
  status: Joi.string(),
  cursor: Joi.string(),
  limit: Joi.number().integer().min(1).max(100),
  sort: Joi.string(),
  expand: Joi.string(),
  analytics: Joi.boolean().truthy('true').falsy('false'),
  include: Joi.string(),
});

const createSchema = Joi.object({
  candidate_id: Joi.string().uuid(),
  resume_url: Joi.string().uri(),
  parsed_fields: Joi.object(),
  notes: Joi.string().allow(''),
  rating: Joi.number().integer().min(1).max(5),
  tags: Joi.array().items(Joi.string().trim().min(1)),
  email: Joi.string().email(),
  phone: Joi.string(),
  stage_id: Joi.string().uuid(),
});

const updateSchema = Joi.object({
  resume_url: Joi.string().uri(),
  parsed_fields: Joi.object(),
  notes: Joi.string().allow(''),
  rating: Joi.number().integer().min(1).max(5),
  tags: Joi.array().items(Joi.string().trim().min(1)),
  status: Joi.string(),
  stage_id: Joi.string().uuid(),
  email: Joi.string().email(),
  phone: Joi.string(),
});

const tagSchema = Joi.object({
  tags: Joi.array().items(Joi.string().trim().min(1)).min(1).required(),
});

const moveSchema = Joi.object({
  to_stage_id: Joi.string().uuid().required(),
});

const scorecardSchema = Joi.object({
  reviewer_id: Joi.string().uuid(),
  overall_rating: Joi.number().integer().min(1).max(5),
  recommendation: Joi.string().valid('strong_hire', 'hire', 'no_hire', 'strong_no_hire', 'undecided'),
  competencies: Joi.object(),
  summary: Joi.string().allow(''),
  submitted_at: Joi.date(),
});

const listForJob = async (req, res, next) => {
  try {
    const payload = await listSchema.validateAsync(req.query, { abortEarly: false, stripUnknown: true });
    const result = await applicationService.listJobApplications(req.params.id, req.user, payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const createForJob = async (req, res, next) => {
  try {
    const payload = await createSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const result = await applicationService.createJobApplication(req.params.id, req.user, payload);
    const response = { status: 201, body: result };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const get = async (req, res, next) => {
  try {
    const expand = req.query.expand ? req.query.expand.split(',').map((value) => value.trim()).filter(Boolean) : [];
    const includeDeleted = req.query.include === 'deleted' && req.user?.role === 'admin';
    const result = await applicationService.getApplication(req.params.id, req.user, { includeDeleted, expand });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const payload = await updateSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const result = await applicationService.updateApplication(req.params.id, req.user, payload);
    const response = { status: 200, body: result };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await applicationService.deleteApplication(req.params.id, req.user);
    const response = { status: 200, body: result };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const move = async (req, res, next) => {
  try {
    const payload = await moveSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const result = await applicationService.moveApplication(req.params.id, req.user, payload.to_stage_id);
    const response = { status: 200, body: result };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const addTags = async (req, res, next) => {
  try {
    const payload = await tagSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const result = await applicationService.addTags(req.params.id, req.user, payload.tags);
    const response = { status: 200, body: result };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const removeTags = async (req, res, next) => {
  try {
    const payload = await tagSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const result = await applicationService.removeTags(req.params.id, req.user, payload.tags);
    const response = { status: 200, body: result };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const listScorecards = async (req, res, next) => {
  try {
    const result = await applicationService.listScorecards(req.params.id, req.user);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

const createScorecard = async (req, res, next) => {
  try {
    const payload = await scorecardSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const result = await applicationService.createScorecard(req.params.id, req.user, payload);
    const response = { status: 201, body: result };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listForJob,
  createForJob,
  get,
  update,
  remove,
  move,
  addTags,
  removeTags,
  listScorecards,
  createScorecard,
};
