const Joi = require('joi');
const service = require('../services/notificationService');

const listSchema = Joi.object({ limit: Joi.number().max(100).default(50), unread_only: Joi.string(), analytics: Joi.string() });
const analyticsSchema = Joi.object({ from: Joi.date(), to: Joi.date() });

const list = async (req, res, next) => {
  try {
    const payload = await listSchema.validateAsync(req.query);
    const data = await service.list(req.user.id, payload);
    res.json({ data });
  } catch (error) {
    next(error);
  }
};

const markRead = async (req, res, next) => {
  try {
    const result = await service.markRead(req.user.id, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const markAll = async (req, res, next) => {
  try {
    const result = await service.markAllRead(req.user.id);
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
    const prefs = await service.updatePreferences(req.user.id, req.body);
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
