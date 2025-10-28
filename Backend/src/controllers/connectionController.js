const Joi = require('joi');
const service = require('../services/connectionService');
const { ApiError } = require('../middleware/errorHandler');

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', { errors: error.details });
  return value;
};

const listSchema = Joi.object({ userId: Joi.string().uuid().optional(), status: Joi.string().optional(), limit: Joi.number(), sort: Joi.string() });
const requestSchema = Joi.object({ to_user_id: Joi.string().uuid().required(), note: Joi.string().allow('', null) });
const connectionActionSchema = Joi.object({ connection_id: Joi.string().uuid().required() });
const analyticsSchema = Joi.object({ userId: Joi.string().uuid().required(), from: Joi.date(), to: Joi.date(), by: Joi.string().valid('day', 'week', 'month').default('day') });

const list = async (req, res, next) => {
  try {
    const payload = validate(listSchema, req.query);
    const result = await service.listConnections(payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const request = async (req, res, next) => {
  try {
    const payload = validate(requestSchema, req.body);
    const result = await service.requestConnection(req.user.id, payload);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const accept = async (req, res, next) => {
  try {
    const payload = validate(connectionActionSchema, req.body);
    const result = await service.acceptConnection(req.user.id, payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const reject = async (req, res, next) => {
  try {
    const payload = validate(connectionActionSchema, req.body);
    const result = await service.rejectConnection(req.user.id, payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await service.deleteConnection(req.params.id, req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const analytics = async (req, res, next) => {
  try {
    const payload = validate(analyticsSchema, req.query);
    const result = await service.networkGrowthAnalytics(payload);
    res.json({ buckets: result });
  } catch (error) {
    next(error);
  }
};

module.exports = { list, request, accept, reject, remove, analytics };
