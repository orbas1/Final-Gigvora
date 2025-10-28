const Joi = require('joi');
const interviewService = require('../services/interviewService');
const { persistIdempotentResponse } = require('../middleware/idempotency');

const listSchema = Joi.object({
  job_id: Joi.string().uuid(),
  application_id: Joi.string().uuid(),
  status: Joi.string(),
  from: Joi.date(),
  to: Joi.date(),
  cursor: Joi.string(),
  limit: Joi.number().integer().min(1).max(100),
  sort: Joi.string(),
  expand: Joi.string(),
  analytics: Joi.boolean().truthy('true').falsy('false'),
  include: Joi.string(),
});

const createSchema = Joi.object({
  job_id: Joi.string().uuid().required(),
  application_id: Joi.string().uuid().required(),
  scheduled_at: Joi.date().required(),
  duration_minutes: Joi.number().integer().min(15).max(480),
  meeting_url: Joi.string().uri().allow(null, ''),
  location: Joi.string().allow('', null),
  status: Joi.string().valid('scheduled', 'completed', 'cancelled'),
  panel: Joi.alternatives().try(Joi.array().items(Joi.object()), Joi.string()),
  notes: Joi.string().allow('', null),
  recording_url: Joi.string().uri().allow('', null),
});

const updateSchema = createSchema.fork(['job_id', 'application_id'], (schema) => schema.forbidden());

const feedbackSchema = Joi.object({
  reviewer_id: Joi.string().uuid(),
  rating: Joi.number().integer().min(1).max(5),
  highlights: Joi.string().allow('', null),
  concerns: Joi.string().allow('', null),
  recommendation: Joi.string().valid('strong_hire', 'hire', 'no_hire', 'strong_no_hire', 'undecided'),
  submitted_at: Joi.date(),
});

const list = async (req, res, next) => {
  try {
    const payload = await listSchema.validateAsync(req.query, { abortEarly: false, stripUnknown: true });
    const result = await interviewService.listInterviews(req.user, payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const payload = await createSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const result = await interviewService.createInterview(req.user, payload);
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
    const result = await interviewService.getInterview(req.params.id, req.user, { includeDeleted, expand });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const payload = await updateSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const result = await interviewService.updateInterview(req.params.id, req.user, payload);
    const response = { status: 200, body: result };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await interviewService.deleteInterview(req.params.id, req.user);
    const response = { status: 200, body: result };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const feedback = async (req, res, next) => {
  try {
    const payload = await feedbackSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const result = await interviewService.submitFeedback(req.params.id, req.user, payload);
    const response = { status: 201, body: result };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

module.exports = { list, create, get, update, remove, feedback };
