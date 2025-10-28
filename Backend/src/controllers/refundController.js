const Joi = require('joi');
const refundService = require('../services/refundService');
const { persistIdempotentResponse } = require('../middleware/idempotency');
const { ApiError } = require('../middleware/errorHandler');

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', { errors: error.details });
  return value;
};

const listSchema = Joi.object({
  escrow_id: Joi.string().uuid().optional(),
  status: Joi.string().optional(),
  cursor: Joi.string().optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  sort: Joi.string().optional(),
  analytics: Joi.string().valid('true', 'false').optional(),
  include: Joi.string().optional(),
});

const createSchema = Joi.object({
  escrow_id: Joi.string().uuid().required(),
  amount: Joi.number().positive().required(),
  reason: Joi.string().allow('', null),
  metadata: Joi.object().optional(),
});

const escrowRefundSchema = Joi.object({
  amount: Joi.number().positive().required(),
  reason: Joi.string().allow('', null),
  metadata: Joi.object().optional(),
});

const updateSchema = Joi.object({
  status: Joi.string().valid('pending', 'processed', 'failed'),
  reason: Joi.string().allow('', null),
  metadata: Joi.object(),
  processed_at: Joi.date(),
}).min(1);

const list = async (req, res, next) => {
  try {
    const query = validate(listSchema, req.query);
    const result = await refundService.listRefunds(req.user, query);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const body = validate(createSchema, req.body);
    const refund = await refundService.createRefund(req.user, body, { idempotencyKey: req.idempotency?.key });
    const response = refund.toJSON();
    await persistIdempotentResponse(req, res, { status: 201, body: response });
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

const get = async (req, res, next) => {
  try {
    const refund = await refundService.getRefund(req.user, req.params.id);
    res.json(refund);
  } catch (error) {
    next(error);
  }
};

const createForEscrow = async (req, res, next) => {
  try {
    const body = validate(escrowRefundSchema, req.body);
    const refund = await refundService.createRefund(
      req.user,
      { ...body, escrow_id: req.params.id },
      { idempotencyKey: req.idempotency?.key }
    );
    const response = refund.toJSON();
    await persistIdempotentResponse(req, res, { status: 201, body: response });
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const body = validate(updateSchema, req.body);
    const refund = await refundService.updateRefund(req.user, req.params.id, body);
    res.json(refund);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await refundService.deleteRefund(req.user, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = { list, create, get, createForEscrow, update, remove };
