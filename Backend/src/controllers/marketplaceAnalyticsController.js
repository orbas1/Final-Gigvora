const Joi = require('joi');
const analyticsService = require('../services/marketplaceAnalyticsService');
const { ApiError } = require('../middleware/errorHandler');

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', { errors: error.details });
  return value;
};

const revenueSchema = Joi.object({
  from: Joi.date(),
  to: Joi.date(),
  group_by: Joi.string().valid('day', 'org', 'user').default('day'),
});

const salesSchema = Joi.object({
  from: Joi.date(),
  to: Joi.date(),
});

const projectRevenue = async (req, res, next) => {
  try {
    const payload = validate(revenueSchema, req.query);
    const analytics = await analyticsService.projectRevenue(payload);
    res.json(analytics);
  } catch (error) {
    next(error);
  }
};

const gigSales = async (req, res, next) => {
  try {
    const payload = validate(salesSchema, req.query);
    const analytics = await analyticsService.gigSales(payload);
    res.json(analytics);
  } catch (error) {
    next(error);
  }
};

module.exports = { projectRevenue, gigSales };
