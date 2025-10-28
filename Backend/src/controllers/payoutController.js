const Joi = require('joi');
const payoutService = require('../services/payoutService');
const { persistIdempotentResponse } = require('../middleware/idempotency');
const { ApiError } = require('../middleware/errorHandler');

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', { errors: error.details });
  return value;
};

const listSchema = Joi.object({
  status: Joi.string().optional(),
  wallet_id: Joi.string().uuid().optional(),
  cursor: Joi.string().optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  sort: Joi.string().optional(),
  analytics: Joi.string().valid('true', 'false').optional(),
  include: Joi.string().optional(),
});

const createSchema = Joi.object({
  payout_account_id: Joi.string().uuid().required(),
  amount: Joi.number().positive().required(),
  currency: Joi.string().length(3).required(),
  metadata: Joi.object().optional(),
});

const updateSchema = Joi.object({
  status: Joi.string().valid('processing', 'completed', 'failed'),
  metadata: Joi.object(),
  failure_code: Joi.string().allow(null, ''),
  failure_message: Joi.string().allow(null, ''),
  processed_at: Joi.date(),
}).min(1);

const list = async (req, res, next) => {
  try {
    const query = validate(listSchema, req.query);
    const result = await payoutService.listPayouts(req.user, query);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const body = validate(createSchema, req.body);
    const payout = await payoutService.createPayout(req.user, body, { idempotencyKey: req.idempotency?.key });
    const response = payout.toJSON();
    await persistIdempotentResponse(req, res, { status: 201, body: response });
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

const get = async (req, res, next) => {
  try {
    const payout = await payoutService.getPayout(req.user, req.params.id);
    res.json(payout);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const body = validate(updateSchema, req.body);
    const payout = await payoutService.updatePayout(req.user, req.params.id, body);
    res.json(payout);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await payoutService.deletePayout(req.user, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = { list, create, get, update, remove };
