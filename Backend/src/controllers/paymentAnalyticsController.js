const Joi = require('joi');
const analyticsService = require('../services/paymentAnalyticsService');
const { ApiError } = require('../middleware/errorHandler');

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', { errors: error.details });
  return value;
};

const rangeSchema = Joi.object({
  from: Joi.date().optional(),
  to: Joi.date().optional(),
});

const gmvSchema = rangeSchema.keys({ by: Joi.string().valid('day', 'week', 'month').optional() });

const gmv = async (req, res, next) => {
  try {
    const params = validate(gmvSchema, req.query);
    const result = await analyticsService.gmv(params);
    res.json({ buckets: result });
  } catch (error) {
    next(error);
  }
};

const takeRate = async (req, res, next) => {
  try {
    const params = validate(rangeSchema, req.query);
    const result = await analyticsService.takeRate(params);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const disputesRate = async (req, res, next) => {
  try {
    const params = validate(rangeSchema, req.query);
    const result = await analyticsService.disputesRate(params);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = { gmv, takeRate, disputesRate };
