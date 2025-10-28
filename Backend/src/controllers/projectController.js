const Joi = require('joi');
const projectService = require('../services/projectService');
const { ApiError } = require('../middleware/errorHandler');
const { persistIdempotentResponse } = require('../middleware/idempotency');

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', { errors: error.details });
  return value;
};

const listSchema = Joi.object({
  q: Joi.string(),
  owner_id: Joi.string().uuid(),
  status: Joi.string(),
  type: Joi.string().valid('fixed', 'hourly'),
  tags: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()),
  limit: Joi.number().integer().min(1),
  cursor: Joi.string(),
  sort: Joi.string(),
  analytics: Joi.string(),
  fields: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()),
  expand: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()),
  include: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()),
  published: Joi.string(),
  from: Joi.date(),
  to: Joi.date(),
});

const milestoneSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().allow('', null),
  amount: Joi.number().positive(),
  currency: Joi.string().length(3),
  due_date: Joi.date().optional(),
});

const projectSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().allow('', null),
  type: Joi.string().valid('fixed', 'hourly').default('fixed'),
  status: Joi.string().valid('draft', 'open', 'in_progress', 'completed', 'cancelled', 'archived'),
  budget_min: Joi.number().positive().allow(null),
  budget_max: Joi.number().positive().allow(null),
  currency: Joi.string().length(3),
  location: Joi.string().allow('', null),
  due_date: Joi.date().allow(null),
  metadata: Joi.object().unknown(true),
  tags: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()),
  milestones: Joi.array().items(milestoneSchema),
  published_at: Joi.date(),
});

const projectUpdateSchema = projectSchema.fork(['title'], (schema) => schema.optional());

const inviteSchema = Joi.object({
  freelancer_id: Joi.string().uuid().required(),
  message: Joi.string().allow('', null),
});

const bidSchema = Joi.object({
  amount: Joi.number().positive().required(),
  currency: Joi.string().length(3),
  timeline: Joi.string().allow('', null),
  proposal: Joi.string().allow('', null),
  attachments: Joi.array().items(Joi.object()).allow(null),
  metadata: Joi.object().unknown(true),
});

const bidUpdateSchema = Joi.object({
  amount: Joi.number().positive(),
  currency: Joi.string().length(3),
  timeline: Joi.string().allow('', null),
  proposal: Joi.string().allow('', null),
  attachments: Joi.array().items(Joi.object()).allow(null),
  metadata: Joi.object().unknown(true),
  status: Joi.string().valid('pending', 'accepted', 'rejected', 'withdrawn'),
});

const milestoneCreateSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().allow('', null),
  amount: Joi.number().positive().allow(null),
  currency: Joi.string().length(3),
  due_date: Joi.date().allow(null),
  status: Joi.string().valid('pending', 'funded', 'released', 'cancelled'),
  sequence: Joi.number().integer().positive(),
  metadata: Joi.object().unknown(true),
});

const milestoneUpdateSchema = milestoneCreateSchema.fork(['title'], (schema) => schema.optional());

const deliverableSchema = Joi.object({
  milestone_id: Joi.string().uuid().allow(null),
  title: Joi.string().required(),
  description: Joi.string().allow('', null),
  attachments: Joi.array().items(Joi.object()).allow(null),
});

const deliverableUpdateSchema = Joi.object({
  title: Joi.string(),
  description: Joi.string().allow('', null),
  attachments: Joi.array().items(Joi.object()).allow(null),
  status: Joi.string().valid('submitted', 'accepted', 'revision_requested'),
});

const timeLogSchema = Joi.object({
  started_at: Joi.date().required(),
  ended_at: Joi.date().optional(),
  duration_minutes: Joi.number().integer().positive().optional(),
  notes: Joi.string().allow('', null),
});

const timeLogUpdateSchema = Joi.object({
  started_at: Joi.date(),
  ended_at: Joi.date(),
  duration_minutes: Joi.number().integer().positive(),
  notes: Joi.string().allow('', null),
  status: Joi.string().valid('pending', 'approved', 'rejected'),
});

const reviewSchema = Joi.object({
  reviewee_id: Joi.string().uuid().required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().allow('', null),
  private_note: Joi.string().allow('', null),
  metadata: Joi.object().unknown(true),
});

const list = async (req, res, next) => {
  try {
    const payload = validate(listSchema, req.query);
    const result = await projectService.listProjects(payload, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const payload = validate(projectSchema, req.body);
    const result = await projectService.createProject(req.user.id, payload);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const get = async (req, res, next) => {
  try {
    const result = await projectService.getProject(req.params.id, req.query, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const payload = validate(projectUpdateSchema, req.body);
    const result = await projectService.updateProject(req.params.id, req.user, payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await projectService.deleteProject(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const listInvites = async (req, res, next) => {
  try {
    const invites = await projectService.listInvites(req.params.id, req.user);
    res.json({ data: invites });
  } catch (error) {
    next(error);
  }
};

const createInvite = async (req, res, next) => {
  try {
    const payload = validate(inviteSchema, req.body);
    const invite = await projectService.createInvite(req.params.id, req.user, payload);
    res.status(201).json(invite);
  } catch (error) {
    next(error);
  }
};

const listBids = async (req, res, next) => {
  try {
    const bids = await projectService.listBids(req.params.id, req.user);
    res.json({ data: bids });
  } catch (error) {
    next(error);
  }
};

const createBid = async (req, res, next) => {
  try {
    const payload = validate(bidSchema, req.body);
    const bid = await projectService.createBid(req.params.id, req.user, payload);
    await persistIdempotentResponse(req, res, { status: 201, body: bid });
    res.status(201).json(bid);
  } catch (error) {
    next(error);
  }
};

const updateBid = async (req, res, next) => {
  try {
    const payload = validate(bidUpdateSchema, req.body);
    const bid = await projectService.updateBid(req.params.id, req.user, payload);
    res.json(bid);
  } catch (error) {
    next(error);
  }
};

const deleteBid = async (req, res, next) => {
  try {
    const result = await projectService.deleteBid(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const listMilestones = async (req, res, next) => {
  try {
    const milestones = await projectService.listMilestones(req.params.id, req.user);
    res.json({ data: milestones });
  } catch (error) {
    next(error);
  }
};

const createMilestone = async (req, res, next) => {
  try {
    const payload = validate(milestoneCreateSchema, req.body);
    const milestone = await projectService.createMilestone(req.params.id, req.user, payload);
    res.status(201).json(milestone);
  } catch (error) {
    next(error);
  }
};

const updateMilestone = async (req, res, next) => {
  try {
    const payload = validate(milestoneUpdateSchema, req.body);
    const milestone = await projectService.updateMilestone(req.params.id, req.user, payload);
    res.json(milestone);
  } catch (error) {
    next(error);
  }
};

const deleteMilestone = async (req, res, next) => {
  try {
    const result = await projectService.deleteMilestone(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const listDeliverables = async (req, res, next) => {
  try {
    const deliverables = await projectService.listDeliverables(req.params.id, req.user);
    res.json({ data: deliverables });
  } catch (error) {
    next(error);
  }
};

const createDeliverable = async (req, res, next) => {
  try {
    const payload = validate(deliverableSchema, req.body);
    const deliverable = await projectService.createDeliverable(req.params.id, req.user, payload);
    res.status(201).json(deliverable);
  } catch (error) {
    next(error);
  }
};

const updateDeliverable = async (req, res, next) => {
  try {
    const payload = validate(deliverableUpdateSchema, req.body);
    const deliverable = await projectService.updateDeliverable(req.params.id, req.user, payload);
    res.json(deliverable);
  } catch (error) {
    next(error);
  }
};

const deleteDeliverable = async (req, res, next) => {
  try {
    const result = await projectService.deleteDeliverable(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const listTimeLogs = async (req, res, next) => {
  try {
    const logs = await projectService.listTimeLogs(req.params.id, req.user);
    res.json({ data: logs });
  } catch (error) {
    next(error);
  }
};

const createTimeLog = async (req, res, next) => {
  try {
    const payload = validate(timeLogSchema, req.body);
    const log = await projectService.createTimeLog(req.params.id, req.user, payload);
    res.status(201).json(log);
  } catch (error) {
    next(error);
  }
};

const updateTimeLog = async (req, res, next) => {
  try {
    const payload = validate(timeLogUpdateSchema, req.body);
    const log = await projectService.updateTimeLog(req.params.id, req.user, payload);
    res.json(log);
  } catch (error) {
    next(error);
  }
};

const deleteTimeLog = async (req, res, next) => {
  try {
    const result = await projectService.deleteTimeLog(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const listReviews = async (req, res, next) => {
  try {
    const reviews = await projectService.listReviews(req.params.id);
    res.json({ data: reviews });
  } catch (error) {
    next(error);
  }
};

const createReview = async (req, res, next) => {
  try {
    const payload = validate(reviewSchema, req.body);
    const review = await projectService.createReview(req.params.id, req.user, payload);
    res.status(201).json(review);
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
  listInvites,
  createInvite,
  listBids,
  createBid,
  updateBid,
  deleteBid,
  listMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  listDeliverables,
  createDeliverable,
  updateDeliverable,
  deleteDeliverable,
  listTimeLogs,
  createTimeLog,
  updateTimeLog,
  deleteTimeLog,
  listReviews,
  createReview,
};
