'use strict';

const Joi = require('joi');
const marketplaceService = require('../services/marketplaceService');
const { ApiError } = require('../middleware/errorHandler');
const { parseArrayParam, normalizeBoolean } = require('../utils/requestParsers');
const { persistIdempotentResponse } = require('../middleware/idempotency');

const commaSeparated = Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string());

const listSchema = Joi.object({
  q: Joi.string(),
  status: Joi.string().valid('draft', 'active', 'paused', 'archived'),
  rate_unit: Joi.string().valid('fixed', 'hourly', 'package'),
  seller_id: Joi.string().uuid(),
  organization_id: Joi.string().uuid(),
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
  organization_id: Joi.string().uuid().allow(null),
  title: Joi.string().max(255).required(),
  slug: Joi.string().max(255).allow('', null),
  description: Joi.string().allow('', null),
  rate_amount: Joi.number().precision(2).allow(null),
  rate_unit: Joi.string().valid('fixed', 'hourly', 'package').default('fixed'),
  location: Joi.string().allow('', null),
  delivery_time_days: Joi.number().integer().min(0).allow(null),
  status: Joi.string().valid('draft', 'active', 'paused', 'archived').default('draft'),
  skills: commaSeparated,
  tags: commaSeparated,
  analytics_snapshot: Joi.object().unknown(true),
}).required();

const updateSchema = createSchema;

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
    const result = await marketplaceService.listGigs(payload, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const get = async (req, res, next) => {
  try {
    const options = buildViewOptions(req);
    const gig = await marketplaceService.getGig(req.params.id, options, req.user);
    res.json({ data: gig });
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
    const gig = await marketplaceService.createGig(payload, req.user, options);
    const body = { data: gig };
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
    const gig = await marketplaceService.updateGig(req.params.id, payload, req.user, options);
    const body = { data: gig };
    await persistIdempotentResponse(req, res, { status: 200, body });
    res.json(body);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await marketplaceService.deleteGig(req.params.id, req.user);
    await persistIdempotentResponse(req, res, { status: 200, body: result });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const analytics = async (req, res, next) => {
  try {
    const payload = buildListPayload(req);
    const data = await marketplaceService.gigAnalytics(payload);
    res.json({ data });
  } catch (error) {
    next(error);
  }
};

module.exports = { list, get, create, update, remove, analytics };
