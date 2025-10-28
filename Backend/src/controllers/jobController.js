'use strict';

const Joi = require('joi');
const marketplaceService = require('../services/marketplaceService');
const { ApiError } = require('../middleware/errorHandler');
const { parseArrayParam, normalizeBoolean } = require('../utils/requestParsers');
const { persistIdempotentResponse } = require('../middleware/idempotency');

const commaSeparated = Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string());

const listSchema = Joi.object({
  q: Joi.string(),
  status: Joi.string().valid('draft', 'open', 'closed', 'archived'),
  employment_type: Joi.string().valid('full_time', 'part_time', 'contract', 'temporary', 'internship'),
  company_id: Joi.string().uuid(),
  remote: Joi.alternatives().try(Joi.boolean(), Joi.string()),
  location: Joi.string(),
  tags: commaSeparated,
  skills: commaSeparated,
  cursor: Joi.string(),
  limit: Joi.number().integer().min(1).max(100),
  sort: Joi.string(),
  fields: commaSeparated,
  expand: commaSeparated,
  include: commaSeparated,
  analytics: Joi.alternatives().try(Joi.boolean(), Joi.string()),
});

const createSchema = Joi.object({
  company_id: Joi.string().uuid().allow(null),
  title: Joi.string().max(255).required(),
  slug: Joi.string().max(255).allow('', null),
  description: Joi.string().allow('', null),
  employment_type: Joi.string()
    .valid('full_time', 'part_time', 'contract', 'temporary', 'internship')
    .required(),
  location: Joi.string().allow('', null),
  remote: Joi.boolean().allow(null),
  salary_min: Joi.number().precision(2).allow(null),
  salary_max: Joi.number().precision(2).allow(null),
  currency: Joi.string().max(10).allow(null),
  skills: commaSeparated,
  tags: commaSeparated,
  status: Joi.string().valid('draft', 'open', 'closed', 'archived').default('open'),
  posted_at: Joi.date().allow(null),
  analytics_snapshot: Joi.object().unknown(true),
}).required();

const updateSchema = createSchema.fork(['title', 'employment_type'], (schema) => schema.optional());

const validate = (schema, payload) => {
  const { value, error } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', { errors: error.details });
  }
  return value;
};

const buildListPayload = (req) => {
  const payload = validate(listSchema, req.query);
  payload.tags = parseArrayParam(req.query.tags ?? payload.tags).map((tag) => tag.toLowerCase());
  payload.skills = parseArrayParam(req.query.skills ?? payload.skills).map((skill) => skill.toLowerCase());
  payload.fields = parseArrayParam(req.query.fields ?? payload.fields);
  payload.expand = parseArrayParam(req.query.expand ?? payload.expand);
  payload.include = parseArrayParam(req.query.include ?? payload.include);
  payload.analytics = normalizeBoolean(payload.analytics);
  payload.remote = payload.remote !== undefined ? normalizeBoolean(payload.remote, undefined) : undefined;
  return payload;
};

const buildViewOptions = (req) => ({
  fields: parseArrayParam(req.query.fields),
  expand: parseArrayParam(req.query.expand),
  include: parseArrayParam(req.query.include),
});

const list = async (req, res, next) => {
  try {
    const payload = buildListPayload(req);
    const result = await marketplaceService.listJobs(payload, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const get = async (req, res, next) => {
  try {
    const options = buildViewOptions(req);
    const job = await marketplaceService.getJob(req.params.id, options, req.user);
    res.json({ data: job });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const payload = validate(createSchema, req.body);
    payload.skills = parseArrayParam(req.body.skills ?? payload.skills);
    payload.tags = parseArrayParam(req.body.tags ?? payload.tags);
    const options = buildViewOptions(req);
    const job = await marketplaceService.createJob(payload, req.user, options);
    const body = { data: job };
    await persistIdempotentResponse(req, res, { status: 201, body });
    res.status(201).json(body);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const payload = validate(updateSchema, req.body);
    if (payload.skills !== undefined) {
      payload.skills = parseArrayParam(req.body.skills ?? payload.skills);
    }
    if (payload.tags !== undefined) {
      payload.tags = parseArrayParam(req.body.tags ?? payload.tags);
    }
    const options = buildViewOptions(req);
    const job = await marketplaceService.updateJob(req.params.id, payload, req.user, options);
    const body = { data: job };
    await persistIdempotentResponse(req, res, { status: 200, body });
    res.json(body);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await marketplaceService.deleteJob(req.params.id, req.user);
    await persistIdempotentResponse(req, res, { status: 200, body: result });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const analytics = async (req, res, next) => {
  try {
    const payload = buildListPayload(req);
    const data = await marketplaceService.jobAnalytics(payload);
    res.json({ data });
  } catch (error) {
    next(error);
  }
};

module.exports = { list, get, create, update, remove, analytics };
