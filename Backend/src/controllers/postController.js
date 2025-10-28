const Joi = require('joi');
const service = require('../services/postService');
const { ApiError } = require('../middleware/errorHandler');

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', { errors: error.details });
  return value;
};

const listSchema = Joi.object({
  feed: Joi.string(),
  author_id: Joi.string().uuid(),
  org_id: Joi.string().uuid(),
  group_id: Joi.string().uuid(),
  analytics: Joi.boolean().truthy('true').falsy('false'),
  limit: Joi.number().integer().min(1).max(100),
  sort: Joi.string(),
  cursor: Joi.string(),
  fields: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())),
  expand: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())),
});
const postSchema = Joi.object({
  content: Joi.string().required(),
  attachments: Joi.array().items(Joi.object()),
  share_ref: Joi.object(),
  group_id: Joi.string().uuid().optional(),
});
const commentSchema = Joi.object({ content: Joi.string().required(), parent_id: Joi.string().uuid().optional() });
const reactionSchema = Joi.object({ type: Joi.string().required() });

const list = async (req, res, next) => {
  try {
    const payload = validate(listSchema, req.query);
    const result = await service.listPosts(payload, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const payload = validate(postSchema, req.body);
    const result = await service.createPost(req.user, payload);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const get = async (req, res, next) => {
  try {
    const result = await service.getPost(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const payload = validate(postSchema, req.body);
    const result = await service.updatePost(req.params.id, req.user, payload);
    res.json(result);
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

const comment = async (req, res, next) => {
  try {
    const payload = validate(commentSchema, req.body);
    const result = await service.createComment(req.user, req.params.id, payload);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const react = async (req, res, next) => {
  try {
    const payload = validate(reactionSchema, req.body);
    const result = await service.react(req.user, req.params.id, payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const removeReaction = async (req, res, next) => {
  try {
    const result = await service.removeReaction(req.user, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = { list, create, get, update, remove, comment, react, removeReaction };
