const Joi = require('joi');
const analyticsService = require('../services/analyticsService');

const funnelSchema = Joi.object({
  job_id: Joi.string().uuid().required(),
});

const interviewLoadSchema = Joi.object({
  from: Joi.date(),
  to: Joi.date(),
});

const jobAnalytics = async (req, res, next) => {
  try {
    const result = await analyticsService.jobAnalytics(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const atsFunnel = async (req, res, next) => {
  try {
    const payload = await funnelSchema.validateAsync(req.query, { abortEarly: false, stripUnknown: true });
    const result = await analyticsService.atsFunnel(payload.job_id, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const interviewLoad = async (req, res, next) => {
  try {
    const payload = await interviewLoadSchema.validateAsync(req.query, { abortEarly: false, stripUnknown: true });
    const result = await analyticsService.interviewLoad(req.user, payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = { jobAnalytics, atsFunnel, interviewLoad };
