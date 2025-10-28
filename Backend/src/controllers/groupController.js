const Joi = require('joi');
const service = require('../services/groupService');
const { ApiError } = require('../middleware/errorHandler');
const { persistIdempotentResponse } = require('../middleware/idempotency');

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', { errors: error.details });
  }
  return value;
};

const stringOrArray = () => Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string()));

const listSchema = Joi.object({
  q: Joi.string(),
  tags: stringOrArray(),
  cursor: Joi.string(),
  limit: Joi.number().integer().min(1).max(100),
  sort: Joi.string(),
  fields: stringOrArray(),
  expand: stringOrArray(),
  include: stringOrArray(),
  analytics: Joi.boolean().truthy('true').falsy('false'),
});

const createSchema = Joi.object({
  name: Joi.string().max(255).required(),
  slug: Joi.string().max(255),
  description: Joi.string().allow('').optional(),
  visibility: Joi.string().valid('public', 'private').default('public'),
  cover_image_url: Joi.string().uri().optional(),
  metadata: Joi.object().optional(),
  tags: Joi.array().items(Joi.string().max(64)).optional(),
});

const updateSchema = Joi.object({
  name: Joi.string().max(255),
  slug: Joi.string().max(255),
  description: Joi.string().allow(''),
  visibility: Joi.string().valid('public', 'private'),
  cover_image_url: Joi.string().uri().allow(null),
  metadata: Joi.object().allow(null),
  tags: Joi.array().items(Joi.string().max(64)),
}).min(1);

const memberListSchema = Joi.object({
  role: Joi.string().valid('member', 'mod', 'owner', 'moderator'),
  cursor: Joi.string(),
  limit: Joi.number().integer().min(1).max(100),
  sort: Joi.string(),
  analytics: Joi.boolean().truthy('true').falsy('false'),
});

const memberRoleSchema = Joi.object({
  role: Joi.string().valid('member', 'mod', 'owner', 'moderator').required(),
});

const analyticsSchema = Joi.object({
  from: Joi.date().optional(),
  to: Joi.date().optional(),
  by: Joi.string().valid('day', 'week', 'month').optional(),
});

const parseIncludeDeleted = (query) => {
  const include = query.include;
  if (!include) return false;
  const values = Array.isArray(include) ? include : String(include).split(',').map((item) => item.trim());
  return values.includes('deleted');
};

const list = async (req, res, next) => {
  try {
    const payload = validate(listSchema, req.query);
    const result = await service.listGroups(payload, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const payload = validate(createSchema, req.body);
    const result = await service.createGroup(req.user, payload);
    await persistIdempotentResponse(req, res, { status: 201, body: result });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const get = async (req, res, next) => {
  try {
    const includeDeleted = parseIncludeDeleted(req.query);
    const result = await service.getGroup(req.params.id, req.user, { includeDeleted });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const payload = validate(updateSchema, req.body);
    const result = await service.updateGroup(req.params.id, req.user, payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await service.deleteGroup(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const join = async (req, res, next) => {
  try {
    const result = await service.joinGroup(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const leave = async (req, res, next) => {
  try {
    const result = await service.leaveGroup(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const members = async (req, res, next) => {
  try {
    const payload = validate(memberListSchema, req.query);
    const result = await service.listMembers(req.params.id, payload, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const updateMember = async (req, res, next) => {
  try {
    const payload = validate(memberRoleSchema, req.body);
    const result = await service.updateMemberRole(req.params.id, req.params.userId, req.user, payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const analytics = async (req, res, next) => {
  try {
    const payload = validate(analyticsSchema, req.query);
    const result = await service.groupAnalytics(req.params.id, payload, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  list,
  create,
  get,
  update,
  remove,
  join,
  leave,
  members,
  updateMember,
  analytics,
};
