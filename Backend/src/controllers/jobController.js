const Joi = require('joi');
const jobService = require('../services/jobService');
const { persistIdempotentResponse } = require('../middleware/idempotency');

const listSchema = Joi.object({
  q: Joi.string().allow(''),
  company_id: Joi.string().uuid(),
  location: Joi.string(),
  tags: Joi.string(),
  salary_min: Joi.number(),
  type: Joi.string(),
  status: Joi.string(),
  cursor: Joi.string(),
  limit: Joi.number().integer().min(1).max(100),
  sort: Joi.string(),
  fields: Joi.string(),
  expand: Joi.string(),
  analytics: Joi.boolean().truthy('true').falsy('false'),
  include: Joi.string(),
});

const jobSchema = Joi.object({
  title: Joi.string().min(3).max(255).required(),
  description: Joi.string().allow(''),
  location: Joi.string().allow(''),
  job_type: Joi.string().allow(''),
  salary_min: Joi.number().min(0),
  salary_max: Joi.number().min(0),
  salary_currency: Joi.string().length(3).uppercase(),
  company_id: Joi.string().uuid(),
  tags: Joi.array().items(Joi.string().trim().min(1)).default([]),
  metadata: Joi.object(),
  stages: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      order_index: Joi.number().integer().min(1),
      is_default: Joi.boolean(),
      auto_advance_days: Joi.number().integer().min(1).allow(null),
    })
  ),
  publish: Joi.boolean(),
  status: Joi.string().valid('draft', 'open', 'paused', 'closed', 'archived'),
  published_at: Joi.date(),
  closes_at: Joi.date().allow(null),
});

const updateSchema = jobSchema.fork(['title'], (schema) => schema.optional());

const list = async (req, res, next) => {
  try {
    const payload = await listSchema.validateAsync(req.query, { abortEarly: false, stripUnknown: true });
    const result = await jobService.listJobs(req.user, payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const payload = await jobSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const job = await jobService.createJob(req.user, payload);
    const response = { status: 201, body: job };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const get = async (req, res, next) => {
  try {
    const includeDeleted = req.query.include === 'deleted' && req.user?.role === 'admin';
    const expand = req.query.expand ? req.query.expand.split(',').map((item) => item.trim()).filter(Boolean) : [];
    const job = await jobService.getJobAndTrackView(req.params.id, req.user, {
      includeDeleted,
      expand,
    });
    res.json(job);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const payload = await updateSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const job = await jobService.updateJob(req.params.id, req.user, payload);
    const response = { status: 200, body: job };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await jobService.deleteJob(req.params.id, req.user);
    const response = { status: 200, body: result };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

module.exports = { list, create, get, update, remove };
