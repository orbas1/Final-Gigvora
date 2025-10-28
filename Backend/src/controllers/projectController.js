const Joi = require('joi');
const projectService = require('../services/projectService');
const { persistIdempotentResponse } = require('../middleware/idempotency');

const listSchema = Joi.object({
  q: Joi.string().allow(''),
  owner_id: Joi.string().uuid(),
  status: Joi.string(),
  type: Joi.string().valid('fixed', 'hourly'),
  tags: Joi.string(),
  cursor: Joi.string(),
  limit: Joi.number().integer().min(1).max(100),
  sort: Joi.string(),
  fields: Joi.string(),
  expand: Joi.string(),
  analytics: Joi.boolean().truthy('true').falsy('false'),
  include: Joi.string(),
});

const projectSchema = Joi.object({
  title: Joi.string().min(3).max(255).required(),
  description: Joi.string().allow(''),
  status: Joi.string().valid('draft', 'open', 'in_progress', 'completed', 'cancelled', 'archived'),
  project_type: Joi.string().valid('fixed', 'hourly'),
  type: Joi.string().valid('fixed', 'hourly'),
  budget_min: Joi.number().min(0).allow(null),
  budget_max: Joi.number().min(0).allow(null),
  budget_currency: Joi.string().length(3).uppercase(),
  hourly_rate: Joi.number().min(0).allow(null),
  estimated_hours: Joi.number().integer().min(0).allow(null),
  timeline: Joi.string().allow(''),
  requirements: Joi.string().allow(''),
  attachments: Joi.array().items(
    Joi.object({ name: Joi.string().required(), url: Joi.string().uri().required() })
  ),
  metadata: Joi.object(),
  tags: Joi.array().items(Joi.string().trim().min(1)).default([]),
  packages: Joi.forbidden(),
});

const updateSchema = projectSchema.fork(['title'], (schema) => schema.optional());

const inviteSchema = Joi.object({
  invitee_id: Joi.string().uuid().required(),
  status: Joi.string().valid('pending', 'accepted', 'declined', 'revoked'),
  message: Joi.string().allow(''),
});

const bidSchema = Joi.object({
  amount: Joi.number().min(0).allow(null),
  currency: Joi.string().length(3).uppercase(),
  bid_type: Joi.string().valid('fixed', 'hourly'),
  type: Joi.string().valid('fixed', 'hourly'),
  hourly_rate: Joi.number().min(0).allow(null),
  proposed_hours: Joi.number().integer().min(0).allow(null),
  cover_letter: Joi.string().allow(''),
  attachments: Joi.array().items(
    Joi.object({ name: Joi.string().required(), url: Joi.string().uri().required() })
  ),
  status: Joi.string().valid('pending', 'accepted', 'rejected', 'withdrawn'),
  estimated_days: Joi.number().integer().min(0).allow(null),
});

const milestoneSchema = Joi.object({
  title: Joi.string().min(3).max(255).required(),
  description: Joi.string().allow(''),
  amount: Joi.number().min(0).allow(null),
  currency: Joi.string().length(3).uppercase(),
  due_date: Joi.date().allow(null),
  order_index: Joi.number().integer().min(1).allow(null),
  status: Joi.string().valid('pending', 'in_progress', 'completed', 'released', 'cancelled'),
});

const milestoneUpdateSchema = milestoneSchema.fork(['title'], (schema) => schema.optional());

const deliverableSchema = Joi.object({
  milestone_id: Joi.string().uuid().allow(null),
  title: Joi.string().min(3).max(255).required(),
  description: Joi.string().allow(''),
  status: Joi.string().valid('submitted', 'in_review', 'changes_requested', 'approved', 'rejected'),
  file_urls: Joi.array().items(
    Joi.object({ name: Joi.string().required(), url: Joi.string().uri().required() })
  ),
});

const deliverableUpdateSchema = deliverableSchema.fork(['title'], (schema) => schema.optional());

const timeLogSchema = Joi.object({
  user_id: Joi.string().uuid().allow(null),
  started_at: Joi.date().required(),
  ended_at: Joi.date().allow(null),
  duration_minutes: Joi.number().integer().min(0).allow(null),
  notes: Joi.string().allow(''),
  hourly_rate: Joi.number().min(0).allow(null),
  billable_amount: Joi.number().min(0).allow(null),
  invoice_status: Joi.string().valid('pending', 'invoiced', 'paid', 'written_off'),
});

const timeLogUpdateSchema = timeLogSchema.fork(['started_at'], (schema) => schema.optional());

const reviewSchema = Joi.object({
  reviewee_id: Joi.string().uuid().allow(null),
  rating: Joi.number().integer().min(1).max(5).required(),
  communication_rating: Joi.number().integer().min(1).max(5).allow(null),
  quality_rating: Joi.number().integer().min(1).max(5).allow(null),
  adherence_rating: Joi.number().integer().min(1).max(5).allow(null),
  comment: Joi.string().allow(''),
  private_notes: Joi.string().allow(''),
});

const listProjects = async (req, res, next) => {
  try {
    const query = await listSchema.validateAsync(req.query, { abortEarly: false, stripUnknown: true });
    const result = await projectService.listProjects(req.user, query);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const createProject = async (req, res, next) => {
  try {
    const payload = await projectSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const project = await projectService.createProject(req.user, payload);
    const response = { status: 201, body: project };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const getProject = async (req, res, next) => {
  try {
    const expand = req.query.expand ? req.query.expand.split(',').map((item) => item.trim()).filter(Boolean) : [];
    const includeDeleted = req.query.include === 'deleted' && req.user?.role === 'admin';
    const project = await projectService.getProject(req.params.id, req.user, {
      expand,
      includeDeleted,
    });
    res.json(project);
  } catch (error) {
    next(error);
  }
};

const updateProject = async (req, res, next) => {
  try {
    const payload = await updateSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const project = await projectService.updateProject(req.params.id, req.user, payload);
    const response = { status: 200, body: project };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const deleteProject = async (req, res, next) => {
  try {
    const result = await projectService.deleteProject(req.params.id, req.user);
    const response = { status: 200, body: result };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
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
    const payload = await inviteSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const invite = await projectService.createInvite(req.params.id, req.user, payload);
    const response = { status: 201, body: invite };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
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
    const payload = await bidSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const bid = await projectService.createBid(req.params.id, req.user, payload);
    const response = { status: 201, body: bid };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const updateBid = async (req, res, next) => {
  try {
    const payload = await bidSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const bid = await projectService.updateBid(req.params.bidId, req.user, payload);
    const response = { status: 200, body: bid };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const deleteBid = async (req, res, next) => {
  try {
    const result = await projectService.deleteBid(req.params.bidId, req.user);
    const response = { status: 200, body: result };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
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
    const payload = await milestoneSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const milestone = await projectService.createMilestone(req.params.id, req.user, payload);
    const response = { status: 201, body: milestone };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const updateMilestone = async (req, res, next) => {
  try {
    const payload = await milestoneUpdateSchema.validateAsync(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    const milestone = await projectService.updateMilestone(req.params.milestoneId, req.user, payload);
    const response = { status: 200, body: milestone };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const deleteMilestone = async (req, res, next) => {
  try {
    const result = await projectService.deleteMilestone(req.params.milestoneId, req.user);
    const response = { status: 200, body: result };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
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
    const payload = await deliverableSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const deliverable = await projectService.createDeliverable(req.params.id, req.user, payload);
    const response = { status: 201, body: deliverable };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const updateDeliverable = async (req, res, next) => {
  try {
    const payload = await deliverableUpdateSchema.validateAsync(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    const deliverable = await projectService.updateDeliverable(req.params.deliverableId, req.user, payload);
    const response = { status: 200, body: deliverable };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const deleteDeliverable = async (req, res, next) => {
  try {
    const result = await projectService.deleteDeliverable(req.params.deliverableId, req.user);
    const response = { status: 200, body: result };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
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
    const payload = await timeLogSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const log = await projectService.createTimeLog(req.params.id, req.user, payload);
    const response = { status: 201, body: log };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const updateTimeLog = async (req, res, next) => {
  try {
    const payload = await timeLogUpdateSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const log = await projectService.updateTimeLog(req.params.timeLogId, req.user, payload);
    const response = { status: 200, body: log };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const deleteTimeLog = async (req, res, next) => {
  try {
    const result = await projectService.deleteTimeLog(req.params.timeLogId, req.user);
    const response = { status: 200, body: result };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
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
    const payload = await reviewSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const review = await projectService.createReview(req.params.id, req.user, payload);
    const response = { status: 201, body: review };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const revenueAnalytics = async (req, res, next) => {
  try {
    const schema = Joi.object({
      from: Joi.date().allow(null),
      to: Joi.date().allow(null),
      group_by: Joi.string().valid('day', 'org', 'user').default('day'),
    });
    const query = await schema.validateAsync(req.query, { abortEarly: false, stripUnknown: true });
    const analytics = await projectService.getRevenueAnalytics(query);
    res.json({ data: analytics });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listProjects,
  createProject,
  getProject,
  updateProject,
  deleteProject,
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
  revenueAnalytics,
};
