const Joi = require('joi');
const reviewService = require('../services/reviewService');
const { ApiError } = require('../middleware/errorHandler');
const { persistIdempotentResponse } = require('../middleware/idempotency');

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', { errors: error.details });
  }
  return value;
};

const createSchema = Joi.object({
  subject_type: Joi.string().valid(...reviewService.SUBJECT_TYPES).required(),
  subject_id: Joi.string().guid({ version: ['uuidv4', 'uuidv5', 'uuidv1'] }).required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().allow('', null),
});

const listSchema = Joi.object({
  subject_type: Joi.string().valid(...reviewService.SUBJECT_TYPES),
  subject_id: Joi.string().guid({ version: ['uuidv4', 'uuidv5', 'uuidv1'] }),
  reviewer_id: Joi.string().guid({ version: ['uuidv4', 'uuidv5', 'uuidv1'] }),
  cursor: Joi.string(),
  limit: Joi.number().integer().min(1).max(100),
  sort: Joi.string(),
  q: Joi.string(),
  fields: Joi.string(),
  expand: Joi.string(),
  include: Joi.string().valid('deleted'),
  analytics: Joi.boolean().truthy('true', '1', 'yes').falsy('false', '0', 'no'),
});

const analyticsSchema = Joi.object({
  subject_type: Joi.string().valid(...reviewService.SUBJECT_TYPES).required(),
  subject_id: Joi.string().guid({ version: ['uuidv4', 'uuidv5', 'uuidv1'] }).required(),
  include: Joi.string(),
});

const create = async (req, res, next) => {
  try {
    const payload = validate(createSchema, req.body);
    const review = await reviewService.createReview(payload, req.user);
    const body = typeof review?.toJSON === 'function' ? review.toJSON() : review;
    await persistIdempotentResponse(req, res, { status: 201, body });
    res.status(201).json(body);
  } catch (error) {
    next(error);
  }
};

const list = async (req, res, next) => {
  try {
    const query = validate(listSchema, req.query);
    const result = await reviewService.listReviews(query, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await reviewService.deleteReview(req.params.id, req.user);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

const averages = async (req, res, next) => {
  try {
    const query = validate(analyticsSchema, req.query);
    const result = await reviewService.averagesAnalytics(query, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  create,
  list,
  remove,
  averages,
};
