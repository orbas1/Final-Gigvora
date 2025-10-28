const Joi = require('joi');
const atsService = require('../services/atsService');
const { persistIdempotentResponse } = require('../middleware/idempotency');

const stageSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  order_index: Joi.number().integer().min(1),
  is_default: Joi.boolean(),
  auto_advance_days: Joi.number().integer().min(1).allow(null),
});

const list = async (req, res, next) => {
  try {
    const include = req.query.include || '';
    const result = await atsService.listStages(req.params.id, req.user, { include });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const payload = await stageSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const result = await atsService.createStage(req.params.id, req.user, payload);
    const response = { status: 201, body: result };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const payload = await stageSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const result = await atsService.updateStage(req.params.id, req.params.stageId, req.user, payload);
    const response = { status: 200, body: result };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await atsService.deleteStage(req.params.id, req.params.stageId, req.user);
    const response = { status: 200, body: result };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

module.exports = { list, create, update, remove };
