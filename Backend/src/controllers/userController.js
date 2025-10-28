const Joi = require('joi');
const userService = require('../services/userService');
const { ApiError } = require('../middleware/errorHandler');

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', { errors: error.details });
  }
  return value;
};

const commaSeparated = Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string());

const listSchema = Joi.object({
  q: Joi.string(),
  skills: commaSeparated,
  location: Joi.string(),
  role: Joi.string(),
  verified: Joi.string(),
  created_between: Joi.string(),
  analytics: Joi.alternatives(Joi.boolean(), Joi.string()),
  expand: commaSeparated,
  fields: commaSeparated,
  include: commaSeparated,
  limit: Joi.number().integer().min(1).max(100),
  sort: Joi.string(),
  cursor: Joi.string(),
});

const createSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  role: Joi.string().optional(),
  is_verified: Joi.boolean(),
  display_name: Joi.string().optional(),
});

const updateSchema = Joi.object({
  password: Joi.string().min(8).optional(),
  role: Joi.string().optional(),
  metadata: Joi.object().optional(),
  is_verified: Joi.boolean().optional(),
});

const reportSchema = Joi.object({
  reason: Joi.string().required(),
  description: Joi.string().allow('', null),
});

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const list = async (req, res, next) => {
  try {
    const payload = validate(listSchema, req.query);
    payload.skills = toArray(req.query.skills ?? payload.skills);
    payload.expand = toArray(req.query.expand ?? payload.expand);
    payload.fields = toArray(req.query.fields ?? payload.fields);
    payload.include = toArray(req.query.include ?? payload.include);
    payload.analytics = payload.analytics === true || payload.analytics === 'true';
    const result = await userService.listUsers(payload, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const payload = validate(createSchema, req.body);
    const result = await userService.createUser(payload);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const get = async (req, res, next) => {
  try {
    const user = await userService.getUser(req.params.id, req.query);
    res.json(user);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const payload = validate(updateSchema, req.body);
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
    }
    const target = await userService.getUser(req.params.id, { includeDeleted: req.query.include });
    const result = await userService.updateUser(target, payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const target = await userService.getUser(req.params.id, {});
    const result = await userService.softDeleteUser(target);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const follow = async (req, res, next) => {
  try {
    const result = await userService.followUser(req.user.id, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const unfollow = async (req, res, next) => {
  try {
    const result = await userService.unfollowUser(req.user.id, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const block = async (req, res, next) => {
  try {
    const result = await userService.blockUser(req.user.id, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const unblock = async (req, res, next) => {
  try {
    const result = await userService.unblockUser(req.user.id, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const report = async (req, res, next) => {
  try {
    const payload = validate(reportSchema, req.body);
    const result = await userService.reportUser(req.user.id, req.params.id, payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const followers = async (req, res, next) => {
  try {
    const result = await userService.getFollowers(req.params.id);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

const following = async (req, res, next) => {
  try {
    const result = await userService.getFollowing(req.params.id);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

const overviewAnalytics = async (req, res, next) => {
  try {
    const result = await userService.overviewAnalytics(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const retention = async (req, res, next) => {
  try {
    const result = await userService.retentionAnalytics(req.query);
    res.json({ cohorts: result });
  } catch (error) {
    next(error);
  }
};

const actives = async (req, res, next) => {
  try {
    const result = await userService.activesAnalytics(req.query);
    res.json({ buckets: result });
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
  follow,
  unfollow,
  block,
  unblock,
  report,
  followers,
  following,
  overviewAnalytics,
  retention,
  actives,
};
