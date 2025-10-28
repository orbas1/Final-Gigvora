const Joi = require('joi');
const service = require('../services/calendarService');
const { ApiError } = require('../middleware/errorHandler');
const { persistIdempotentResponse } = require('../middleware/idempotency');

const validate = (schema, payload, options = {}) => {
  const { error, value } = schema.validate(payload, {
    abortEarly: false,
    stripUnknown: true,
    ...options,
  });
  if (error) {
    throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', { errors: error.details });
  }
  return value;
};

const attendeeSchema = Joi.object({
  user_id: Joi.string().uuid(),
  email: Joi.string().email(),
  name: Joi.string().allow('', null),
  status: Joi.string().valid('needs_action', 'accepted', 'declined', 'tentative'),
  role: Joi.string().valid('organizer', 'attendee'),
  responded_at: Joi.date().iso(),
  metadata: Joi.object(),
}).or('user_id', 'email');

const listSchema = Joi.object({
  from: Joi.date().iso(),
  to: Joi.date().iso(),
  scope: Joi.string().valid('user', 'org'),
  org_id: Joi.string().uuid(),
  owner_id: Joi.string().uuid(),
  status: Joi.string().valid('confirmed', 'tentative', 'cancelled'),
  q: Joi.string().allow(''),
  limit: Joi.number().integer().min(1).max(100),
  cursor: Joi.string(),
  sort: Joi.string(),
  fields: Joi.string(),
  expand: Joi.string(),
  analytics: Joi.string(),
  include: Joi.string().valid('deleted'),
});

const createSchema = Joi.object({
  title: Joi.string().max(255).required(),
  description: Joi.string().allow('', null),
  location: Joi.string().allow('', null),
  start_at: Joi.date().iso().required(),
  end_at: Joi.date().iso().greater(Joi.ref('start_at')).required(),
  all_day: Joi.boolean().default(false),
  visibility: Joi.string().valid('private', 'team', 'public').default('private'),
  scope: Joi.string().valid('user', 'org').default('user'),
  org_id: Joi.string().uuid(),
  status: Joi.string().valid('confirmed', 'tentative', 'cancelled').default('confirmed'),
  source: Joi.string().max(255),
  metadata: Joi.object(),
  attendees: Joi.array().items(attendeeSchema),
});

const updateSchema = Joi.object({
  title: Joi.string().max(255),
  description: Joi.string().allow('', null),
  location: Joi.string().allow('', null),
  start_at: Joi.date().iso(),
  end_at: Joi.date().iso(),
  all_day: Joi.boolean(),
  visibility: Joi.string().valid('private', 'team', 'public'),
  scope: Joi.string().valid('user', 'org'),
  org_id: Joi.string().uuid(),
  status: Joi.string().valid('confirmed', 'tentative', 'cancelled'),
  source: Joi.string().max(255),
  metadata: Joi.object(),
  attendees: Joi.array().items(attendeeSchema),
}).min(1);

const integrationSchema = Joi.object({
  provider: Joi.string().max(64).required(),
  external_account_id: Joi.string().allow('', null),
  access_token: Joi.string().allow('', null),
  refresh_token: Joi.string().allow('', null),
  expires_at: Joi.date().iso().allow(null),
  scope: Joi.string().allow('', null),
  settings: Joi.object(),
});

const icsSchema = Joi.object({
  token: Joi.string().required(),
});

const analyticsSchema = Joi.object({
  from: Joi.date().iso(),
  to: Joi.date().iso(),
  by: Joi.string().valid('hour'),
  scope: Joi.string().valid('user', 'org'),
  org_id: Joi.string().uuid(),
});

const getSchema = Joi.object({
  include: Joi.string().valid('deleted'),
});

const normalizeTemporal = (payload) => {
  const normalized = { ...payload };
  if (normalized.start_at) normalized.start_at = new Date(normalized.start_at);
  if (normalized.end_at) normalized.end_at = new Date(normalized.end_at);
  if (normalized.expires_at) normalized.expires_at = new Date(normalized.expires_at);
  if (Array.isArray(normalized.attendees)) {
    normalized.attendees = normalized.attendees.map((attendee) => ({
      ...attendee,
      responded_at: attendee.responded_at ? new Date(attendee.responded_at) : undefined,
    }));
  }
  return normalized;
};

const list = async (req, res, next) => {
  try {
    const payload = validate(listSchema, req.query);
    const result = await service.listEvents(req.user, payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const payload = normalizeTemporal(validate(createSchema, req.body));
    const result = await service.createEvent(req.user, payload);
    await persistIdempotentResponse(req, res, { status: 201, body: result });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const get = async (req, res, next) => {
  try {
    const payload = validate(getSchema, req.query);
    const includeDeleted = payload.include === 'deleted';
    const result = await service.getEvent(req.user, req.params.id, { includeDeleted });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const payload = normalizeTemporal(validate(updateSchema, req.body));
    if (payload.start_at && payload.end_at && payload.end_at <= payload.start_at) {
      throw new ApiError(400, 'end_at must be after start_at', 'VALIDATION_ERROR');
    }
    const result = await service.updateEvent(req.user, req.params.id, payload);
    await persistIdempotentResponse(req, res, { status: 200, body: result });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await service.deleteEvent(req.user, req.params.id);
    await persistIdempotentResponse(req, res, { status: 200, body: result });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const ics = async (req, res, next) => {
  try {
    const payload = validate(icsSchema, req.query, { allowUnknown: true });
    const icsBody = await service.getIcsFeed(payload.token);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="gigvora-calendar.ics"');
    res.status(200).send(icsBody);
  } catch (error) {
    next(error);
  }
};

const connectIntegration = async (req, res, next) => {
  try {
    const payload = normalizeTemporal(validate(integrationSchema, req.body));
    const { integration, created } = await service.connectIntegration(req.user, payload);
    const status = created ? 201 : 200;
    await persistIdempotentResponse(req, res, { status, body: integration });
    res.status(status).json(integration);
  } catch (error) {
    next(error);
  }
};

const disconnectIntegration = async (req, res, next) => {
  try {
    const provider = req.params.provider;
    if (!provider) {
      throw new ApiError(400, 'provider is required', 'VALIDATION_ERROR');
    }
    const result = await service.disconnectIntegration(req.user, provider);
    await persistIdempotentResponse(req, res, { status: 200, body: result });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const busyHours = async (req, res, next) => {
  try {
    const payload = validate(analyticsSchema, req.query);
    const result = await service.busyHoursAnalytics(req.user, payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  list,
  create,
  get,
  update,
  remove,
  ics,
  connectIntegration,
  disconnectIntegration,
  busyHours,
};
