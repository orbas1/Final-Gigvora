const Joi = require('joi');
const webhookService = require('../services/paymentWebhookService');
const { ApiError } = require('../middleware/errorHandler');

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', { errors: error.details });
  return value;
};

const webhookSchema = Joi.object({
  type: Joi.string().required(),
  data: Joi.object().required(),
}).unknown(true);

const process = async (req, res, next) => {
  try {
    const payload = validate(webhookSchema, req.body);
    const result = await webhookService.processWebhook(payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = { process };
