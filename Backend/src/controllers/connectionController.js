const Joi = require('joi');
const service = require('../services/connectionService');
const { ApiError } = require('../middleware/errorHandler');
const { persistIdempotentResponse } = require('../middleware/idempotency');

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', { errors: error.details });
  return value;
};

const selectableSchema = Joi.object({
  expand: Joi.alternatives(Joi.string(), Joi.array().items(Joi.string())),
  fields: Joi.alternatives(Joi.string(), Joi.array().items(Joi.string())),
  include: Joi.alternatives(Joi.string(), Joi.array().items(Joi.string())),
});

const listSchema = Joi.object({
  userId: Joi.string().uuid(),
  status: Joi.alternatives(Joi.string(), Joi.array().items(Joi.string())),
  limit: Joi.number().integer().min(1).max(100),
  sort: Joi.string(),
  cursor: Joi.string(),
  analytics: Joi.alternatives(Joi.boolean(), Joi.string()),
  direction: Joi.string().valid('incoming', 'outgoing', 'all'),
  q: Joi.string().max(255),
}).concat(selectableSchema);

const requestSchema = Joi.object({
  to_user_id: Joi.string().uuid().required(),
  note: Joi.string().max(2000).allow('', null),
});

const connectionActionSchema = Joi.object({ connection_id: Joi.string().uuid().required() });

const showSchema = Joi.object({ id: Joi.string().uuid().required() });

const updateSchema = Joi.object({
  id: Joi.string().uuid().required(),
  note: Joi.string().max(2000).allow('', null),
}).or('note');

const analyticsSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  from: Joi.date(),
  to: Joi.date().min(Joi.ref('from')),
  by: Joi.string().valid('day', 'week', 'month').default('day'),
});

const list = async (req, res, next) => {
  try {
    const payload = validate(listSchema, req.query);
    const result = await service.listConnections(payload, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const show = async (req, res, next) => {
  try {
    const params = validate(showSchema, req.params);
    const options = validate(selectableSchema, req.query || {});
    const connection = await service.getConnection(params.id, req.user, options);
    res.json(connection);
  } catch (error) {
    next(error);
  }
};

const request = async (req, res, next) => {
  try {
    const payload = validate(requestSchema, req.body);
    const connection = await service.requestConnection(req.user.id, payload);
    const responseBody = connection?.toJSON ? connection.toJSON() : connection;
    await persistIdempotentResponse(req, res, { status: 201, body: responseBody });
    res.status(201).json(responseBody);
  } catch (error) {
    next(error);
  }
};

const accept = async (req, res, next) => {
  try {
    const payload = validate(connectionActionSchema, req.body);
    const connection = await service.acceptConnection(req.user.id, payload);
    const responseBody = connection?.toJSON ? connection.toJSON() : connection;
    await persistIdempotentResponse(req, res, { status: 200, body: responseBody });
    res.json(responseBody);
  } catch (error) {
    next(error);
  }
};

const reject = async (req, res, next) => {
  try {
    const payload = validate(connectionActionSchema, req.body);
    const connection = await service.rejectConnection(req.user.id, payload);
    const responseBody = connection?.toJSON ? connection.toJSON() : connection;
    await persistIdempotentResponse(req, res, { status: 200, body: responseBody });
    res.json(responseBody);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const payload = validate(updateSchema, { ...req.params, ...req.body });
    const options = validate(selectableSchema, req.query || {});
    const { id, ...changes } = payload;
    const connection = await service.updateConnection(req.user, id, changes, options);
    const responseBody = connection?.toJSON ? connection.toJSON() : connection;
    await persistIdempotentResponse(req, res, { status: 200, body: responseBody });
    res.json(responseBody);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await service.deleteConnection(req.params.id, req.user);
    await persistIdempotentResponse(req, res, { status: 200, body: result });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const analytics = async (req, res, next) => {
  try {
    const payload = validate(analyticsSchema, req.query);
    if (req.user?.role !== 'admin' && payload.userId !== req.user?.id) {
      throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
    }
    const result = await service.networkGrowthAnalytics(payload);
    res.json({ buckets: result });
  } catch (error) {
    next(error);
  }
};

module.exports = { list, show, request, accept, reject, update, remove, analytics };
