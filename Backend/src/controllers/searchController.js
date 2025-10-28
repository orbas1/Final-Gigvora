const Joi = require('joi');
const searchService = require('../services/searchService');
const { ApiError } = require('../middleware/errorHandler');

const commaSeparated = Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string());

const searchSchema = Joi.object({
  q: Joi.string().allow('', null),
  type: Joi.string()
    .valid('people', 'freelancers', 'agencies', 'companies', 'projects', 'gigs', 'jobs', 'groups')
    .default('people'),
  location: Joi.string().allow('', null),
  skills: commaSeparated,
  tags: commaSeparated,
  cursor: Joi.string(),
  limit: Joi.number().integer().min(1).max(100),
  sort: Joi.string(),
  fields: commaSeparated,
  expand: commaSeparated,
  include: commaSeparated,
  analytics: Joi.alternatives(Joi.boolean(), Joi.string()),
});

const suggestionsSchema = Joi.object({
  q: Joi.string().allow('', null),
  type: Joi.string().valid('skills', 'tags', 'titles', 'companies').required(),
  limit: Joi.number().integer().min(1).max(25).default(10),
});

const historySchema = Joi.object({
  q: Joi.string().allow('', null),
  type: Joi.string().valid('people', 'freelancers', 'agencies', 'companies', 'projects', 'gigs', 'jobs', 'groups'),
  cursor: Joi.string(),
  limit: Joi.number().integer().min(1).max(100),
  sort: Joi.string(),
  include: commaSeparated,
  expand: commaSeparated,
  analytics: Joi.alternatives(Joi.boolean(), Joi.string()),
  user_id: Joi.string().guid({ version: 'uuidv4' }).optional(),
});

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean);
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', { errors: error.details });
  }
  return value;
};

const normaliseSearchQuery = (req) => {
  const payload = validate(searchSchema, req.query);
  return {
    ...payload,
    skills: toArray(req.query.skills ?? payload.skills),
    tags: toArray(req.query.tags ?? payload.tags),
    fields: toArray(req.query.fields ?? payload.fields),
    expand: toArray(req.query.expand ?? payload.expand),
    include: toArray(req.query.include ?? payload.include),
    analytics: payload.analytics === true || payload.analytics === 'true',
  };
};

const normaliseHistoryQuery = (req) => {
  const payload = validate(historySchema, req.query);
  return {
    ...payload,
    include: toArray(req.query.include ?? payload.include),
    expand: toArray(req.query.expand ?? payload.expand),
    analytics: payload.analytics === true || payload.analytics === 'true',
  };
};

const search = async (req, res, next) => {
  try {
    const params = normaliseSearchQuery(req);
    const result = await searchService.search(params, req.user, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const suggestions = async (req, res, next) => {
  try {
    const payload = validate(suggestionsSchema, req.query);
    const result = await searchService.getSuggestions(payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const history = async (req, res, next) => {
  try {
    const params = normaliseHistoryQuery(req);
    const result = await searchService.listHistory(params, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const idSchema = Joi.string().guid({ version: 'uuidv4' }).required();

const removeHistory = async (req, res, next) => {
  try {
    validate(idSchema, req.params.id);
    const result = await searchService.removeHistory(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const restoreHistory = async (req, res, next) => {
  try {
    validate(idSchema, req.params.id);
    const result = await searchService.restoreHistory(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  search,
  suggestions,
  history,
  removeHistory,
  restoreHistory,
};
