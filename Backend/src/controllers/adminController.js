const Joi = require('joi');
const service = require('../services/adminService');

const overviewSchema = Joi.object({ from: Joi.date(), to: Joi.date() });
const restoreSchema = Joi.object({
  entity_type: Joi.string()
    .valid(
      'user',
      'profile',
      'project',
      'project_bid',
      'project_milestone',
      'project_deliverable',
      'project_time_log',
      'project_review',
      'gig',
      'gig_addon',
      'gig_faq',
      'gig_order',
      'order_submission',
      'order_review'
    )
    .required(),
  id: Joi.string().uuid().required(),
});

const overview = async (req, res, next) => {
  try {
    const payload = await overviewSchema.validateAsync(req.query);
    const result = await service.overview(payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const users = async (req, res, next) => {
  try {
    const result = await service.listUsers();
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

const restore = async (req, res, next) => {
  try {
    const payload = await restoreSchema.validateAsync(req.body);
    const result = await service.restore(payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = { overview, users, restore };
