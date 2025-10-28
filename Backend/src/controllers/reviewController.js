const Joi = require('joi');
const reviewService = require('../services/reviewService');
const { persistIdempotentResponse } = require('../middleware/idempotency');

const listSchema = Joi.object({
  subject_type: Joi.string().valid(...reviewService.SUBJECT_TYPES),
  subject_id: Joi.string().guid({ version: 'uuidv4' }),
  reviewer_id: Joi.string().guid({ version: 'uuidv4' }),
  cursor: Joi.string(),
  limit: Joi.number().integer().min(1).max(100),
  sort: Joi.string(),
  q: Joi.string().allow(''),
  fields: Joi.string(),
  expand: Joi.string(),
  include: Joi.string(),
  analytics: Joi.string(),
  min_rating: Joi.number().integer().min(1).max(5),
  max_rating: Joi.number().integer().min(1).max(5),
});

const createSchema = Joi.object({
  subject_type: Joi.string().valid(...reviewService.SUBJECT_TYPES).required(),
  subject_id: Joi.string().guid({ version: 'uuidv4' }).required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().max(2000).allow('', null),
  reviewer_id: Joi.string().guid({ version: 'uuidv4' }),
  metadata: Joi.object().unknown(true),
});

const analyticsSchema = Joi.object({
  subject_type: Joi.string().valid(...reviewService.SUBJECT_TYPES).required(),
  subject_id: Joi.string().guid({ version: 'uuidv4' }).required(),
  include: Joi.string(),
});

const list = async (req, res, next) => {
  try {
    const query = await listSchema.validateAsync(req.query, { abortEarly: false, stripUnknown: true });
    const result = await reviewService.list(query, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const payload = await createSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const review = await reviewService.create(payload, req.user);
    const response = { data: review };
    persistIdempotentResponse(req, res, { status: 201, body: response });
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await reviewService.remove(req.params.id, req.user);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const analyticsAverages = async (req, res, next) => {
  try {
    const query = await analyticsSchema.validateAsync(req.query, { abortEarly: false, stripUnknown: true });
    const result = await reviewService.analyticsAverages(query, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  list,
  create,
  remove,
  analyticsAverages,
};
