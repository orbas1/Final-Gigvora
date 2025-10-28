const Joi = require('joi');
const suggestionService = require('../services/suggestionService');
const { ApiError } = require('../middleware/errorHandler');
const { persistIdempotentResponse } = require('../middleware/idempotency');

const commaSeparated = Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string());

const listSchema = Joi.object({
  for: Joi.string().valid('feed', 'people', 'groups', 'companies', 'projects', 'gigs', 'jobs').default('feed'),
  user_id: Joi.string().uuid().optional(),
  cursor: Joi.string().optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  sort: Joi.string().optional(),
  q: Joi.string().allow('', null).optional(),
  analytics: Joi.alternatives(Joi.boolean(), Joi.string()).optional(),
  fields: commaSeparated.optional(),
  expand: commaSeparated.optional(),
  include: commaSeparated.optional(),
});

const exploreSchema = Joi.object({
  for: commaSeparated.optional(),
  cursor: Joi.string().optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  sort: Joi.string().optional(),
  q: Joi.string().allow('', null).optional(),
  analytics: Joi.alternatives(Joi.boolean(), Joi.string()).optional(),
  fields: commaSeparated.optional(),
  expand: commaSeparated.optional(),
  include: commaSeparated.optional(),
});

const detailQuerySchema = Joi.object({
  expand: commaSeparated.optional(),
  fields: commaSeparated.optional(),
  include: commaSeparated.optional(),
});

const createBodySchema = Joi.object({
  user_id: Joi.alternatives(Joi.string().uuid(), Joi.valid(null)).optional(),
  suggestion_for: Joi.string()
    .valid('feed', 'people', 'groups', 'companies', 'projects', 'gigs', 'jobs')
    .required(),
  entity_id: Joi.alternatives(Joi.string().uuid(), Joi.valid(null)).optional(),
  entity_type: Joi.string().allow('', null).optional(),
  entity_ref_id: Joi.alternatives(Joi.string().uuid(), Joi.valid(null)).optional(),
  entity_ref_type: Joi.string().allow('', null).optional(),
  score: Joi.number().precision(4).optional(),
  reason: Joi.string().allow('', null).optional(),
  metadata: Joi.object().unknown(true).optional(),
  search_terms: Joi.string().allow('', null).optional(),
  expires_at: Joi.date().optional(),
  delivered_at: Joi.date().optional(),
  pinned: Joi.boolean().optional(),
});

const updateBodySchema = Joi.object({
  user_id: Joi.forbidden(),
  suggestion_for: Joi.string().valid('feed', 'people', 'groups', 'companies', 'projects', 'gigs', 'jobs'),
  entity_id: Joi.alternatives(Joi.string().uuid(), Joi.valid(null)),
  entity_type: Joi.string().allow('', null),
  entity_ref_id: Joi.alternatives(Joi.string().uuid(), Joi.valid(null)),
  entity_ref_type: Joi.string().allow('', null),
  score: Joi.number().precision(4),
  reason: Joi.string().allow('', null),
  metadata: Joi.object().unknown(true),
  search_terms: Joi.string().allow('', null),
  expires_at: Joi.date(),
  delivered_at: Joi.date(),
  pinned: Joi.boolean(),
}).min(1);

const eventBodySchema = Joi.object({
  event_type: Joi.string().valid('impression', 'click', 'dismiss', 'save').required(),
  occurred_at: Joi.date().optional(),
  context: Joi.object().unknown(true).optional(),
});

const eventListSchema = Joi.object({
  event_type: commaSeparated.optional(),
  cursor: Joi.string().optional(),
  limit: Joi.number().integer().min(1).max(200).optional(),
  sort: Joi.string().optional(),
  analytics: Joi.alternatives(Joi.boolean(), Joi.string()).optional(),
  include: commaSeparated.optional(),
});

const analyticsSchema = Joi.object({
  from: Joi.date().optional(),
  to: Joi.date().optional(),
  granularity: Joi.string().valid('hour', 'day', 'month').optional(),
  expand: commaSeparated.optional(),
  fields: commaSeparated.optional(),
  include: commaSeparated.optional(),
});

const idParamSchema = Joi.object({ id: Joi.string().uuid().required() });

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', { errors: error.details });
  }
  return value;
};

const list = async (req, res, next) => {
  try {
    const payload = validate(listSchema, req.query);
    const result = await suggestionService.listSuggestions(payload, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const explore = async (req, res, next) => {
  try {
    const payload = validate(exploreSchema, req.query);
    const result = await suggestionService.exploreSuggestions(payload, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const body = validate(createBodySchema, req.body);
    const query = validate(detailQuerySchema, req.query || {});
    const expand = toArray(query.expand);
    const fields = toArray(query.fields);
    const result = await suggestionService.createSuggestion(body, req.user, { expand, fields });
    const response = { data: result };
    await persistIdempotentResponse(req, res, { status: 201, body: response });
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

const show = async (req, res, next) => {
  try {
    const params = validate(idParamSchema, req.params);
    const query = validate(detailQuerySchema, req.query || {});
    const result = await suggestionService.getSuggestion(params.id, query, req.user);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const params = validate(idParamSchema, req.params);
    const body = validate(updateBodySchema, req.body);
    const query = validate(detailQuerySchema, req.query || {});
    const expand = toArray(query.expand);
    const fields = toArray(query.fields);
    const include = toArray(query.include);
    const result = await suggestionService.updateSuggestion(
      params.id,
      body,
      req.user,
      { expand, fields, include }
    );
    const response = { data: result };
    await persistIdempotentResponse(req, res, { status: 200, body: response });
    res.json(response);
  } catch (error) {
    next(error);
  }
};

const destroy = async (req, res, next) => {
  try {
    const params = validate(idParamSchema, req.params);
    await suggestionService.deleteSuggestion(params.id, req.user);
    await persistIdempotentResponse(req, res, { status: 204, body: null });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const restore = async (req, res, next) => {
  try {
    const params = validate(idParamSchema, req.params);
    const query = validate(detailQuerySchema, req.query || {});
    const expand = toArray(query.expand);
    const fields = toArray(query.fields);
    const result = await suggestionService.restoreSuggestion(params.id, req.user, {
      expand,
      fields,
    });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

const recordEvent = async (req, res, next) => {
  try {
    const params = validate(idParamSchema, req.params);
    const body = validate(eventBodySchema, req.body);
    const result = await suggestionService.recordEvent(params.id, body, req.user);
    const response = { data: result };
    await persistIdempotentResponse(req, res, { status: 201, body: response });
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

const listEvents = async (req, res, next) => {
  try {
    const params = validate(idParamSchema, req.params);
    const query = validate(eventListSchema, req.query || {});
    const result = await suggestionService.listSuggestionEvents(params.id, query, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const analytics = async (req, res, next) => {
  try {
    const params = validate(idParamSchema, req.params);
    const query = validate(analyticsSchema, req.query || {});
    const result = await suggestionService.suggestionAnalytics(params.id, query, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  list,
  explore,
  create,
  show,
  update,
  destroy,
  restore,
  recordEvent,
  listEvents,
  analytics,
};
