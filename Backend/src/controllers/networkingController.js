const Joi = require('joi');
const networkingService = require('../services/networkingService');
const { ApiError } = require('../middleware/errorHandler');

const validate = (schema, payload, options = {}) => {
  const { error, value } = schema.validate(payload, {
    abortEarly: false,
    stripUnknown: true,
    ...options,
  });
  if (error) {
    throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', { errors: error.details });
  }
  return value;
};

const commaSeparated = Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string());

const listSchema = Joi.object({
  duration: Joi.number().integer().valid(2, 5).optional(),
  paid: Joi.boolean()
    .truthy('true')
    .truthy('1')
    .truthy('yes')
    .falsy('false')
    .falsy('0')
    .falsy('no')
    .optional(),
  topic: Joi.string().max(120).optional(),
  q: Joi.string().max(255).optional(),
  cursor: Joi.string().optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  sort: Joi.string().optional(),
  analytics: Joi.boolean().truthy('true').truthy('1').falsy('false').falsy('0').optional(),
  include: Joi.string().valid('deleted').optional(),
  fields: commaSeparated.optional(),
  expand: commaSeparated.optional(),
});

const createSchema = Joi.object({
  topic: Joi.string().min(3).max(120).required(),
  description: Joi.string().max(1000).allow('', null),
  duration_minutes: Joi.number().valid(2, 5).required(),
  is_paid: Joi.boolean().required(),
  status: Joi.string().valid('open', 'closed', 'draft').default('open'),
  max_participants: Joi.number().integer().min(2).max(10).default(2),
  metadata: Joi.object().optional(),
});

const updateSchema = Joi.object({
  topic: Joi.string().min(3).max(120).optional(),
  description: Joi.string().max(1000).allow('', null).optional(),
  duration_minutes: Joi.number().valid(2, 5).optional(),
  is_paid: Joi.boolean().optional(),
  status: Joi.string().valid('open', 'closed', 'draft').optional(),
  max_participants: Joi.number().integer().min(2).max(10).optional(),
  metadata: Joi.object().allow(null).optional(),
});

const viewSchema = Joi.object({
  include: Joi.string().valid('deleted').optional(),
  fields: commaSeparated.optional(),
  expand: commaSeparated.optional(),
});

const joinSchema = Joi.object({
  lobby_id: Joi.string().uuid().required(),
});

const rateSchema = Joi.object({
  stars: Joi.number().integer().min(1).max(5).required(),
  note: Joi.string().max(1000).allow('', null),
});

const analyticsSchema = Joi.object({
  from: Joi.date().optional(),
  to: Joi.date().optional(),
  by: Joi.string().valid('day', 'week', 'month').default('day'),
  duration: Joi.number().integer().valid(2, 5).optional(),
});

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const listLobbies = async (req, res, next) => {
  try {
    const query = validate(listSchema, req.query, { convert: true });
    query.fields = toArray(req.query.fields ?? query.fields);
    query.expand = toArray(req.query.expand ?? query.expand);
    const result = await networkingService.listLobbies(req.user, query);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const createLobby = async (req, res, next) => {
  try {
    const payload = validate(createSchema, req.body, { convert: true });
    const view = validate(viewSchema, req.query, { convert: true });
    view.fields = toArray(req.query.fields ?? view.fields);
    view.expand = toArray(req.query.expand ?? view.expand);
    const result = await networkingService.createLobby(req.user, payload, view);
    res.location(`/api/v1/networking/lobbies/${result.id}`);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const getLobby = async (req, res, next) => {
  try {
    const view = validate(viewSchema, req.query, { convert: true });
    view.fields = toArray(req.query.fields ?? view.fields);
    view.expand = toArray(req.query.expand ?? view.expand);
    const result = await networkingService.getLobby(req.user, req.params.id, view);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const updateLobby = async (req, res, next) => {
  try {
    const payload = validate(updateSchema, req.body, { convert: true });
    const view = validate(viewSchema, req.query, { convert: true });
    view.fields = toArray(req.query.fields ?? view.fields);
    view.expand = toArray(req.query.expand ?? view.expand);
    const result = await networkingService.updateLobby(req.user, req.params.id, payload, view);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const deleteLobby = async (req, res, next) => {
  try {
    const view = validate(viewSchema, req.query, { convert: true });
    view.fields = toArray(req.query.fields ?? view.fields);
    view.expand = toArray(req.query.expand ?? view.expand);
    const result = await networkingService.deleteLobby(req.user, req.params.id, view);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const joinSession = async (req, res, next) => {
  try {
    const payload = validate(joinSchema, req.body, { convert: true });
    const result = await networkingService.joinLobby(req, res, req.user, payload);
    res.status(result.status).json(result.payload);
  } catch (error) {
    next(error);
  }
};

const getSession = async (req, res, next) => {
  try {
    const result = await networkingService.getSession(req.user, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const leaveSession = async (req, res, next) => {
  try {
    const result = await networkingService.leaveSession(req.user, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const rateSession = async (req, res, next) => {
  try {
    const payload = validate(rateSchema, req.body, { convert: true });
    const result = await networkingService.rateSession(req.user, req.params.id, payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const analyticsUsage = async (req, res, next) => {
  try {
    const query = validate(analyticsSchema, req.query, { convert: true });
    const result = await networkingService.analyticsUsage(query);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listLobbies,
  createLobby,
  getLobby,
  updateLobby,
  deleteLobby,
  joinSession,
  getSession,
  leaveSession,
  rateSession,
  analyticsUsage,
};
