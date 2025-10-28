const Joi = require('joi');
const service = require('../services/supportService');
const { ApiError } = require('../middleware/errorHandler');
const { persistIdempotentResponse } = require('../middleware/idempotency');

const listSchema = Joi.object({
  status: Joi.string().valid('open', 'pending', 'closed'),
  priority: Joi.string().valid('low', 'normal', 'high'),
  user_id: Joi.string().uuid(),
  limit: Joi.number().integer().min(1).max(100),
  cursor: Joi.string(),
  sort: Joi.string(),
  q: Joi.string().max(255),
  include: Joi.string(),
  expand: Joi.string(),
  fields: Joi.string(),
  analytics: Joi.alternatives(Joi.boolean(), Joi.string()),
});
const createSchema = Joi.object({
  subject: Joi.string().max(255).required(),
  priority: Joi.string().valid('low', 'normal', 'high'),
  message: Joi.string().allow('').optional(),
});
const messageSchema = Joi.object({ message: Joi.string().min(1).required() });
const updateSchema = Joi.object({
  status: Joi.string().valid('open', 'pending', 'closed'),
  priority: Joi.string().valid('low', 'normal', 'high'),
  subject: Joi.string().max(255),
}).or('status', 'priority', 'subject');
const analyticsSchema = Joi.object({
  from: Joi.date(),
  to: Joi.date(),
  by: Joi.string().valid('day', 'week', 'month').default('day'),
});
const deleteSchema = Joi.object({ force: Joi.alternatives(Joi.boolean(), Joi.string()) });

const list = async (req, res, next) => {
  try {
    const payload = await listSchema.validateAsync(req.query);
    const result = await service.listTickets(payload, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const payload = await createSchema.validateAsync(req.body);
    const ticket = await service.createTicket(req.user, payload);
    await persistIdempotentResponse(req, res, { status: 201, body: ticket });
    res.status(201).json(ticket);
  } catch (error) {
    next(error);
  }
};

const get = async (req, res, next) => {
  try {
    const ticket = await service.getTicket(req.params.id, req.user, req.query);
    if (!ticket) throw new ApiError(404, 'Ticket not found', 'TICKET_NOT_FOUND');
    res.json(ticket);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const payload = await updateSchema.validateAsync(req.body);
    const ticket = await service.updateTicket(req.params.id, payload, req.user);
    res.json(ticket);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const payload = await deleteSchema.validateAsync(req.query);
    const force = payload.force === true || payload.force === 'true';
    await service.deleteTicket(req.params.id, req.user, { force });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const message = async (req, res, next) => {
  try {
    const payload = await messageSchema.validateAsync(req.body);
    const msg = await service.addMessage(req.user, req.params.id, payload);
    await persistIdempotentResponse(req, res, { status: 201, body: msg });
    res.status(201).json(msg);
  } catch (error) {
    next(error);
  }
};

const analytics = async (req, res, next) => {
  try {
    const payload = await analyticsSchema.validateAsync(req.query);
    const result = await service.slaAnalytics(payload, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = { list, create, get, update, remove, message, analytics };
