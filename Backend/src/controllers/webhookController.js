const Joi = require('joi');
const service = require('../services/webhookService');
const { ApiError } = require('../middleware/errorHandler');

const booleanSchema = Joi.boolean().truthy('true').falsy('false');

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', { errors: error.details });
  }
  return value;
};

const createSchema = Joi.object({
  name: Joi.string().max(120).required(),
  url: Joi.string()
    .uri({ scheme: ['https'] })
    .message('Webhook endpoint must be an HTTPS URL')
    .required(),
  events: Joi.array().items(Joi.string().trim().min(1)).min(1).required(),
  owner_id: Joi.string().guid({ version: 'uuidv4' }),
  status: Joi.string().valid('active', 'paused', 'disabled'),
}).required();

const listQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100),
  cursor: Joi.string(),
  sort: Joi.string(),
  status: Joi.string(),
  q: Joi.string().max(255),
  include: Joi.string().valid('deleted'),
  analytics: booleanSchema,
  owner_id: Joi.string().guid({ version: 'uuidv4' }),
}).unknown(true);

const deliveriesQuerySchema = Joi.object({
  subscription_id: Joi.string().guid({ version: 'uuidv4' }),
  status: Joi.string(),
  limit: Joi.number().integer().min(1).max(100),
  cursor: Joi.string(),
  sort: Joi.string(),
  include: Joi.string().valid('deleted'),
  analytics: booleanSchema,
  owner_id: Joi.string().guid({ version: 'uuidv4' }),
  from: Joi.date().iso(),
  to: Joi.date().iso(),
}).unknown(true);

const getQuerySchema = Joi.object({
  include: Joi.string().valid('deleted'),
}).unknown(true);

const updateSchema = Joi.object({
  name: Joi.string().max(120),
  url: Joi.string().uri({ scheme: ['https'] }).message('Webhook endpoint must be an HTTPS URL'),
  events: Joi.array().items(Joi.string().trim().min(1)).min(1),
  status: Joi.string().valid('active', 'paused', 'disabled'),
  owner_id: Joi.string().guid({ version: 'uuidv4' }),
  reset_delivery_metrics: booleanSchema,
})
  .min(1)
  .messages({ 'object.min': 'At least one field must be supplied to update the webhook subscription' });

const idParamSchema = Joi.string().guid({ version: 'uuidv4' }).required();

const list = async (req, res, next) => {
  try {
    const query = validate(listQuerySchema, req.query);
    const subs = await service.list(req.user, query);
    res.json(subs);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const payload = validate(createSchema, req.body);
    const sub = await service.create(req, res, req.user, payload);
    res.status(201).json(sub);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const id = validate(idParamSchema, req.params.id);
    await service.remove(req.user, id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

const deliveries = async (req, res, next) => {
  try {
    const query = validate(deliveriesQuerySchema, req.query);
    const result = await service.deliveries(req.user, query);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const get = async (req, res, next) => {
  try {
    const id = validate(idParamSchema, req.params.id);
    const query = validate(getQuerySchema, req.query);
    const sub = await service.get(req.user, id, query);
    res.json(sub);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const id = validate(idParamSchema, req.params.id);
    const payload = validate(updateSchema, req.body);
    const sub = await service.update(req.user, id, payload);
    res.json(sub);
  } catch (error) {
    next(error);
  }
};

const rotateSecret = async (req, res, next) => {
  try {
    const id = validate(idParamSchema, req.params.id);
    const result = await service.rotateSecret(req, res, req.user, id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = { list, create, get, update, remove, deliveries, rotateSecret };
