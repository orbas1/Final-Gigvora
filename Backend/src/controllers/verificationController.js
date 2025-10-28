const Joi = require('joi');
const service = require('../services/verificationService');
const { persistIdempotentResponse } = require('../middleware/idempotency');

const startSchema = Joi.object({
  subject_type: Joi.string().valid('user', 'org').required(),
  subject_id: Joi.string().uuid().optional(),
  data: Joi.object().default({}),
});
const statusSchema = Joi.object({
  subject_type: Joi.string().valid('user', 'org').required(),
  subject_id: Joi.string().uuid().required(),
});

const start = async (req, res, next) => {
  try {
    const payload = await startSchema.validateAsync(req.body);
    const result = await service.start(req.user, payload);
    await persistIdempotentResponse(req, res, { status: 201, body: result });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const status = async (req, res, next) => {
  try {
    const payload = await statusSchema.validateAsync(req.query);
    const result = await service.status(payload, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const webhook = async (req, res, next) => {
  try {
    const result = await service.webhook(req.body, req.headers, req.rawBody);
    res.status(202).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = { start, status, webhook };
