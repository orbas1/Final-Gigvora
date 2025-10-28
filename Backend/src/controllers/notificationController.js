const Joi = require('joi');
const service = require('../services/notificationService');

const listSchema = Joi.object({
  cursor: Joi.string(),
  limit: Joi.number().integer().min(1).max(100),
  sort: Joi.string(),
  q: Joi.string().allow(''),
  fields: Joi.string(),
  include: Joi.string(),
  unread_only: Joi.string(),
  analytics: Joi.string(),
});

const preferencesSchema = Joi.object({
  channels: Joi.object()
    .pattern(/.*/, Joi.object().unknown(true))
    .unknown(true),
  digest: Joi.object({ frequency: Joi.string().valid('immediate', 'hourly', 'daily', 'weekly') }).unknown(true),
}).unknown(true);

const markAllSchema = Joi.object({ before: Joi.date() });

const analyticsSchema = Joi.object({ from: Joi.date(), to: Joi.date() });

const list = async (req, res, next) => {
  try {
    const payload = await listSchema.validateAsync(req.query, { abortEarly: false, stripUnknown: true });
    const data = await service.list(req.user, payload);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

const markRead = async (req, res, next) => {
  try {
    const result = await service.markRead(req.user.id, req.params.id);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

const markAll = async (req, res, next) => {
  try {
    const payload = await markAllSchema.validateAsync(req.body || {}, { abortEarly: false, stripUnknown: true });
    const result = await service.markAllRead(req.user.id, payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getPreferences = async (req, res, next) => {
  try {
    const prefs = await service.getPreferences(req.user.id);
    res.json({ preferences: prefs });
  } catch (error) {
    next(error);
  }
};

const updatePreferences = async (req, res, next) => {
  try {
    const payload = await preferencesSchema.validateAsync(req.body || {}, { abortEarly: false, stripUnknown: true });
    const prefs = await service.updatePreferences(req.user.id, payload);
    res.json({ preferences: prefs });
  } catch (error) {
    next(error);
  }
};

const analytics = async (req, res, next) => {
  try {
    const payload = await analyticsSchema.validateAsync(req.query);
    const result = await service.deliveryAnalytics(payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = { list, markRead, markAll, getPreferences, updatePreferences, analytics };
