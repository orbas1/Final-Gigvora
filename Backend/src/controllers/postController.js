const Joi = require('joi');
const service = require('../services/postService');
const { ApiError } = require('../middleware/errorHandler');
const { persistIdempotentResponse } = require('../middleware/idempotency');

const FEED_TYPES = ['home', 'profile', 'company', 'group'];
const REACTION_TYPES = ['like', 'celebrate', 'support', 'curious', 'insightful', 'love'];

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', { errors: error.details });
  }
  return value;
};

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const toBoolean = (value) => value === true || value === 'true';

const listSchema = Joi.object({
  feed: Joi.string()
    .valid(...FEED_TYPES)
    .default('home'),
  author_id: Joi.string().uuid(),
  org_id: Joi.string().uuid(),
  cursor: Joi.string(),
  limit: Joi.number().integer().min(1).max(100),
  sort: Joi.string(),
  q: Joi.string().max(500),
  fields: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()),
  expand: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()),
  include: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()),
  analytics: Joi.alternatives().try(Joi.boolean(), Joi.string()),
});

const postCreateSchema = Joi.object({
  content: Joi.string().trim().min(1).required(),
  attachments: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().allow(null),
        url: Joi.string().uri().required(),
        type: Joi.string().max(50).allow(null),
        name: Joi.string().max(255).allow(null),
      })
    )
    .max(10),
  share_ref: Joi.object().unknown(true),
  visibility: Joi.string().valid('public', 'connections', 'private'),
  org_id: Joi.string().uuid().allow(null),
  analytics_snapshot: Joi.object().unknown(true),
});

const postUpdateSchema = postCreateSchema.fork(['content'], (schema) => schema.optional());

const commentCreateSchema = Joi.object({
  content: Joi.string().trim().min(1).required(),
  parent_id: Joi.string().uuid().allow(null),
});

const commentUpdateSchema = Joi.object({
  content: Joi.string().trim().min(1).required(),
});

const commentListSchema = Joi.object({
  cursor: Joi.string(),
  limit: Joi.number().integer().min(1).max(100),
  sort: Joi.string(),
  parent_id: Joi.string().uuid().allow(null),
  expand: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()),
  include: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()),
  analytics: Joi.alternatives().try(Joi.boolean(), Joi.string()),
});

const reactionSchema = Joi.object({
  type: Joi.string()
    .valid(...REACTION_TYPES)
    .required(),
});

const reactionListSchema = Joi.object({
  grouped: Joi.alternatives().try(Joi.boolean(), Joi.string()).default(false),
});

const reactionDeleteSchema = Joi.object({
  type: Joi.string().valid(...REACTION_TYPES),
});

const shareSchema = Joi.object({
  channel: Joi.string().max(50).allow(null, ''),
  message: Joi.string().max(2000).allow(null, ''),
  metadata: Joi.object().unknown(true),
});

const trendingSchema = Joi.object({
  window: Joi.string().pattern(/^[0-9]+[hdw]$/i).default('24h'),
  limit: Joi.number().integer().min(1).max(50).default(10),
  expand: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()),
});

const postGetSchema = Joi.object({
  expand: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()),
  fields: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()),
  include: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()),
  record_view: Joi.alternatives().try(Joi.boolean(), Joi.string()).default(true),
});

const feedHealthSchema = Joi.object({
  from: Joi.date().iso(),
  to: Joi.date().iso(),
});

const handleFeedMetric = async (fn) => {
  try {
    await fn();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Failed to record feed metric', error);
  }
};

const list = async (req, res, next) => {
  const started = Date.now();
  let payload;
  try {
    payload = validate(listSchema, req.query);
    payload.expand = toArray(req.query.expand ?? payload.expand);
    payload.fields = toArray(req.query.fields ?? payload.fields);
    payload.include = toArray(req.query.include ?? payload.include);
    payload.includeDeleted = payload.include.includes('deleted') && req.user?.role === 'admin';
    payload.analytics = toBoolean(payload.analytics);

    const result = await service.listPosts(payload, req.user);
    await handleFeedMetric(() =>
      service.recordFeedMetric({
        feed: payload.feed,
        userId: req.user?.id,
        latencyMs: Date.now() - started,
        error: false,
        statusCode: 200,
      })
    );
    res.json(result);
  } catch (error) {
    await handleFeedMetric(() =>
      service.recordFeedMetric({
        feed: payload?.feed || req.query.feed || 'home',
        userId: req.user?.id,
        latencyMs: Date.now() - started,
        error: true,
        statusCode: error.statusCode || 500,
        errorCode: error.code,
      })
    );
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const payload = validate(postCreateSchema, req.body);
    const post = await service.createPost(req.user, payload);
    await persistIdempotentResponse(req, res, { status: 201, body: post });
    res.status(201).json(post);
  } catch (error) {
    next(error);
  }
};

const get = async (req, res, next) => {
  try {
    const payload = validate(postGetSchema, req.query);
    const expand = toArray(req.query.expand ?? payload.expand);
    const fields = toArray(req.query.fields ?? payload.fields);
    const include = toArray(req.query.include ?? payload.include);
    const includeDeleted = include.includes('deleted') && req.user?.role === 'admin';
    const recordView = toBoolean(payload.record_view);

    const post = await service.getPost(req.params.id, {
      expand,
      fields,
      includeDeleted,
      currentUser: req.user,
      recordView,
      requestContext: { ip: req.ip, userAgent: req.headers['user-agent'] },
    });
    res.json(post);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const payload = validate(postUpdateSchema, req.body);
    if (!Object.keys(payload).length) {
      throw new ApiError(400, 'No changes supplied', 'VALIDATION_ERROR');
    }
    const post = await service.updatePost(req.params.id, req.user, payload);
    res.json(post);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await service.deletePost(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const listComments = async (req, res, next) => {
  try {
    const payload = validate(commentListSchema, req.query);
    payload.expand = toArray(req.query.expand ?? payload.expand);
    payload.include = toArray(req.query.include ?? payload.include);
    payload.includeDeleted = payload.include.includes('deleted') && req.user?.role === 'admin';
    payload.analytics = toBoolean(payload.analytics);

    const result = await service.listComments(req.params.postId, payload, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const createComment = async (req, res, next) => {
  try {
    const payload = validate(commentCreateSchema, req.body);
    const comment = await service.createComment(req.user.id, req.params.postId, payload);
    await persistIdempotentResponse(req, res, { status: 201, body: comment });
    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
};

const updateComment = async (req, res, next) => {
  try {
    const payload = validate(commentUpdateSchema, req.body);
    const comment = await service.updateComment(req.params.id, req.user, payload);
    res.json(comment);
  } catch (error) {
    next(error);
  }
};

const deleteComment = async (req, res, next) => {
  try {
    const result = await service.deleteComment(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const addReaction = async (req, res, next) => {
  try {
    const payload = validate(reactionSchema, req.body);
    const reaction = await service.addReaction(req.user.id, req.params.id, payload);
    res.json(reaction);
  } catch (error) {
    next(error);
  }
};

const removeReaction = async (req, res, next) => {
  try {
    const payload = validate(reactionDeleteSchema, req.query);
    const result = await service.removeReaction(req.user.id, req.params.id, payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const listReactions = async (req, res, next) => {
  try {
    const payload = validate(reactionListSchema, req.query);
    const result = await service.listReactions(req.params.id, {
      grouped: toBoolean(payload.grouped),
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const share = async (req, res, next) => {
  try {
    const payload = validate(shareSchema, req.body || {});
    const shareResult = await service.sharePost(req.user.id, req.params.id, payload);
    await persistIdempotentResponse(req, res, { status: 201, body: shareResult });
    res.status(201).json(shareResult);
  } catch (error) {
    next(error);
  }
};

const trending = async (req, res, next) => {
  try {
    const payload = validate(trendingSchema, req.query);
    payload.expand = toArray(req.query.expand ?? payload.expand);
    const result = await service.getTrendingPosts(payload, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const analytics = async (req, res, next) => {
  try {
    const result = await service.getPostAnalytics(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const feedHealth = async (req, res, next) => {
  try {
    const payload = validate(feedHealthSchema, req.query);
    const result = await service.getFeedHealth(payload);
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
  listComments,
  createComment,
  updateComment,
  deleteComment,
  addReaction,
  removeReaction,
  listReactions,
  share,
  trending,
  analytics,
  feedHealth,
};
