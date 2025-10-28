'use strict';

const Joi = require('joi');
const marketplaceService = require('../services/marketplaceService');
const { ApiError } = require('../middleware/errorHandler');
const { parseArrayParam, normalizeBoolean } = require('../utils/requestParsers');
const { persistIdempotentResponse } = require('../middleware/idempotency');

const commaSeparated = Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string());

const listSchema = Joi.object({
  q: Joi.string(),
  privacy: Joi.string().valid('public', 'private'),
  owner_id: Joi.string().uuid(),
  location: Joi.string(),
  tags: commaSeparated,
  cursor: Joi.string(),
  limit: Joi.number().integer().min(1).max(100),
  sort: Joi.string(),
  fields: commaSeparated,
  expand: commaSeparated,
  include: commaSeparated,
  analytics: Joi.alternatives().try(Joi.boolean(), Joi.string()),
});

const createSchema = Joi.object({
  name: Joi.string().max(255).required(),
  slug: Joi.string().max(255).allow('', null),
  description: Joi.string().allow('', null),
  privacy: Joi.string().valid('public', 'private').default('public'),
  location: Joi.string().allow('', null),
  tags: commaSeparated,
  member_count: Joi.number().integer().min(0).allow(null),
  analytics_snapshot: Joi.object().unknown(true),
}).required();

const updateSchema = createSchema.fork(['name'], (schema) => schema.optional());

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
    const result = await marketplaceService.listGroups(payload, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const get = async (req, res, next) => {
  try {
    const options = buildViewOptions(req);
    const group = await marketplaceService.getGroup(req.params.id, options, req.user);
    res.json({ data: group });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const payload = validate(createSchema, req.body);
    payload.tags = parseArrayParam(req.body.tags ?? payload.tags);
    const options = buildViewOptions(req);
    const group = await marketplaceService.createGroup(payload, req.user, options);
    const body = { data: group };
    await persistIdempotentResponse(req, res, { status: 201, body });
    res.status(201).json(body);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const payload = validate(updateSchema, req.body);
    if (payload.tags !== undefined) {
      payload.tags = parseArrayParam(req.body.tags ?? payload.tags);
    }
    const options = buildViewOptions(req);
    const group = await marketplaceService.updateGroup(req.params.id, payload, req.user, options);
    const body = { data: group };
    await persistIdempotentResponse(req, res, { status: 200, body });
    res.json(body);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await marketplaceService.deleteGroup(req.params.id, req.user);
    await persistIdempotentResponse(req, res, { status: 200, body: result });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const analytics = async (req, res, next) => {
  try {
    const payload = buildListPayload(req);
    const data = await marketplaceService.groupAnalytics(payload);
    res.json({ data });
  } catch (error) {
    next(error);
  }
};

module.exports = { list, get, create, update, remove, analytics };
