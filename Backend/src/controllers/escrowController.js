const Joi = require('joi');
const escrowService = require('../services/escrowService');
const { persistIdempotentResponse } = require('../middleware/idempotency');
const { ApiError } = require('../middleware/errorHandler');

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', { errors: error.details });
  return value;
};

const listSchema = Joi.object({
  status: Joi.string().optional(),
  reference_type: Joi.string().optional(),
  reference_id: Joi.string().optional(),
  cursor: Joi.string().optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  sort: Joi.string().optional(),
  analytics: Joi.string().valid('true', 'false').optional(),
});

const createSchema = Joi.object({
  reference_type: Joi.string().required(),
  reference_id: Joi.string().required(),
  amount: Joi.number().positive().required(),
  currency: Joi.string().length(3).required(),
  payee_user_id: Joi.string().uuid().required(),
  metadata: Joi.object().optional(),
});

const captureSchema = Joi.object({
  amount: Joi.number().positive().optional(),
});

const holdSchema = Joi.object({ reason: Joi.string().required() });

const list = async (req, res, next) => {
  try {
    const query = validate(listSchema, req.query);
    const result = await escrowService.listEscrows(req.user, query);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const body = validate(createSchema, req.body);
    const intent = await escrowService.createIntent(req.user, body, { idempotencyKey: req.idempotency?.key });
    const response = intent.toJSON();
    await persistIdempotentResponse(req, res, { status: 201, body: response });
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

const get = async (req, res, next) => {
  try {
    const intent = await escrowService.loadIntent(req.params.id, req.user);
    res.json(intent);
  } catch (error) {
    next(error);
  }
};

const capture = async (req, res, next) => {
  try {
    const body = validate(captureSchema, req.body);
    const intent = await escrowService.captureIntent(req.user, req.params.id, body, {
      idempotencyKey: req.idempotency?.key,
    });
    const response = intent.toJSON();
    await persistIdempotentResponse(req, res, { status: 200, body: response });
    res.json(response);
  } catch (error) {
    next(error);
  }
};

const cancel = async (req, res, next) => {
  try {
    const intent = await escrowService.cancelIntent(req.user, req.params.id);
    res.json(intent);
  } catch (error) {
    next(error);
  }
};

const hold = async (req, res, next) => {
  try {
    const body = validate(holdSchema, req.body);
    const intent = await escrowService.setHold(req.user, req.params.id, body.reason);
    res.json(intent);
  } catch (error) {
    next(error);
  }
};

const release = async (req, res, next) => {
  try {
    const intent = await escrowService.releaseHold(req.user, req.params.id);
    res.json(intent);
  } catch (error) {
    next(error);
  }
};

module.exports = { list, create, get, capture, cancel, hold, release };
