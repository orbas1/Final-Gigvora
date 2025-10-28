const Joi = require('joi');
const service = require('../services/supportService');
const { ApiError } = require('../middleware/errorHandler');

const listSchema = Joi.object({ status: Joi.string(), limit: Joi.number(), sort: Joi.string() });
const createSchema = Joi.object({ subject: Joi.string().required(), priority: Joi.string().valid('low', 'normal', 'high'), message: Joi.string().required() });
const messageSchema = Joi.object({ message: Joi.string().required() });
const updateSchema = Joi.object({ status: Joi.string(), priority: Joi.string() });
const analyticsSchema = Joi.object({ from: Joi.date(), to: Joi.date(), by: Joi.string().valid('day', 'week', 'month') });

const list = async (req, res, next) => {
  try {
    const payload = await listSchema.validateAsync(req.query);
    const result = await service.listTickets(payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const payload = await createSchema.validateAsync(req.body);
    const ticket = await service.createTicket(req.user.id, payload);
    res.status(201).json(ticket);
  } catch (error) {
    next(error);
  }
};

const get = async (req, res, next) => {
  try {
    const ticket = await service.getTicket(req.params.id);
    if (!ticket) throw new ApiError(404, 'Ticket not found', 'TICKET_NOT_FOUND');
    res.json(ticket);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const payload = await updateSchema.validateAsync(req.body);
    const ticket = await service.updateTicket(req.params.id, payload);
    res.json(ticket);
  } catch (error) {
    next(error);
  }
};

const message = async (req, res, next) => {
  try {
    const payload = await messageSchema.validateAsync(req.body);
    const msg = await service.addMessage(req.user.id, req.params.id, payload);
    res.status(201).json(msg);
  } catch (error) {
    next(error);
  }
};

const analytics = async (req, res, next) => {
  try {
    const payload = await analyticsSchema.validateAsync(req.query);
    const result = await service.slaAnalytics(payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = { list, create, get, update, message, analytics };
