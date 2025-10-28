const Joi = require('joi');
const searchService = require('../services/searchService');
const { ApiError } = require('../middleware/errorHandler');

const commaSeparated = Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string());

const searchSchema = Joi.object({
  q: Joi.string().allow('', null),
  type: Joi.string().valid('people', 'freelancers', 'agencies', 'companies', 'projects', 'gigs', 'jobs', 'groups'),
  location: Joi.string(),
  skills: commaSeparated,
  tags: commaSeparated,
  cursor: Joi.string(),
  limit: Joi.number().integer().min(1).max(100),
  sort: Joi.string(),
  fields: commaSeparated,
  expand: commaSeparated,
  include: commaSeparated,
  analytics: Joi.alternatives().try(Joi.boolean(), Joi.string()),
});

const suggestionsSchema = Joi.object({
  q: Joi.string().allow('', null),
  type: Joi.string().valid('skills', 'tags', 'titles', 'companies').required(),
  limit: Joi.number().integer().min(1).max(50),
});

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', { errors: error.details });
  }
  return value;
};

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((item) => item !== undefined && item !== null).map(String);
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeBool = (value) => value === true || value === 'true';

const search = async (req, res, next) => {
  try {
    const payload = validate(searchSchema, req.query);
    payload.skills = toArray(req.query.skills ?? payload.skills);
    payload.tags = toArray(req.query.tags ?? payload.tags);
    payload.fields = toArray(req.query.fields ?? payload.fields);
    payload.expand = toArray(req.query.expand ?? payload.expand);
    payload.include = toArray(req.query.include ?? payload.include);
    payload.analytics = normalizeBool(payload.analytics);
    const result = await searchService.search(payload, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const suggestions = async (req, res, next) => {
  try {
    const payload = validate(suggestionsSchema, req.query);
    payload.limit = payload.limit ? Number(payload.limit) : undefined;
    const result = await searchService.getSuggestions(payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = { search, suggestions };
