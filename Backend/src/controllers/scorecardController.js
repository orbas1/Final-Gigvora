const Joi = require('joi');
const applicationService = require('../services/applicationService');
const { persistIdempotentResponse } = require('../middleware/idempotency');

const scorecardSchema = Joi.object({
  reviewer_id: Joi.string().uuid(),
  overall_rating: Joi.number().integer().min(1).max(5),
  recommendation: Joi.string().valid('strong_hire', 'hire', 'no_hire', 'strong_no_hire', 'undecided'),
  competencies: Joi.object(),
  summary: Joi.string().allow(''),
  submitted_at: Joi.date(),
});

const update = async (req, res, next) => {
  try {
    const payload = await scorecardSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const result = await applicationService.updateScorecard(req.params.scorecardId, req.user, payload);
    const response = { status: 200, body: result };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await applicationService.deleteScorecard(req.params.scorecardId, req.user);
    const response = { status: 200, body: result };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

module.exports = { update, remove };
