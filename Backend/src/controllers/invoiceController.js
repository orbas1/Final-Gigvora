const Joi = require('joi');
const invoiceService = require('../services/invoiceService');
const { ApiError } = require('../middleware/errorHandler');

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', { errors: error.details });
  return value;
};

const querySchema = Joi.object({
  wallet_id: Joi.string().uuid().optional(),
  entity_type: Joi.string().optional(),
  entity_id: Joi.string().optional(),
  from: Joi.date().optional(),
  to: Joi.date().optional(),
  cursor: Joi.string().optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  sort: Joi.string().optional(),
  analytics: Joi.string().valid('true', 'false').optional(),
  include: Joi.string().optional(),
});

const list = async (req, res, next) => {
  try {
    const query = validate(querySchema, req.query);
    const result = await invoiceService.listInvoices(req.user, query);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const get = async (req, res, next) => {
  try {
    const invoice = await invoiceService.getInvoice(req.user, req.params.id);
    res.json(invoice);
  } catch (error) {
    next(error);
  }
};

module.exports = { list, get };
