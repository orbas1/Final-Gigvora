const Joi = require('joi');
const service = require('../services/disputeService');
const { ApiError } = require('../middleware/errorHandler');
const { persistIdempotentResponse } = require('../middleware/idempotency');
const { Dispute, DisputeSettlement } = require('../models');

const listSchema = Joi.object({
  entity_type: Joi.string().valid('project', 'order'),
  status: Joi.alternatives(Joi.string(), Joi.array().items(Joi.string())),
  cursor: Joi.string(),
  limit: Joi.number().integer().min(1).max(100),
  sort: Joi.string(),
  q: Joi.string(),
  fields: Joi.string(),
  expand: Joi.string(),
  analytics: Joi.boolean(),
  include: Joi.string(),
});

const createSchema = Joi.object({
  entity_type: Joi.string().valid('project', 'order').required(),
  entity_ref: Joi.string().max(255).required(),
  reason: Joi.string().max(255).required(),
  details: Joi.string().allow('', null),
  metadata: Joi.object().unknown(true),
  assigned_to: Joi.string().uuid(),
});

const updateSchema = Joi.object({
  status: Joi.string().valid(...Dispute.STATUSES),
  assigned_to: Joi.string().uuid().allow(null),
  resolution_summary: Joi.string().allow('', null),
}).min(1);

const listMessagesSchema = Joi.object({
  cursor: Joi.string(),
  limit: Joi.number().integer().min(1).max(100),
  sort: Joi.string(),
  include: Joi.string(),
});

const messageSchema = Joi.object({
  body: Joi.string().min(1).required(),
  attachments: Joi.array().items(Joi.object().unknown(true)).default([]),
  visibility: Joi.string().valid('party', 'internal').default('party'),
});

const messageUpdateSchema = Joi.object({
  body: Joi.string().min(1),
  attachments: Joi.array().items(Joi.object().unknown(true)),
  visibility: Joi.string().valid('party', 'internal'),
}).min(1);

const evidenceSchema = Joi.object({
  kind: Joi.string().max(100).required(),
  title: Joi.string().allow('', null),
  description: Joi.string().allow('', null),
  file_id: Joi.string().uuid().allow(null),
  metadata: Joi.object().unknown(true),
});

const evidenceUpdateSchema = Joi.object({
  kind: Joi.string().max(100),
  title: Joi.string().allow('', null),
  description: Joi.string().allow('', null),
  file_id: Joi.string().uuid().allow(null),
  metadata: Joi.object().unknown(true),
}).min(1);

const settlementSchema = Joi.object({
  type: Joi.string().valid('partial', 'full').required(),
  amount: Joi.number().positive().precision(2).allow(null),
  currency: Joi.string().length(3).uppercase().allow(null),
  terms: Joi.string().allow('', null),
  metadata: Joi.object().unknown(true),
  status: Joi.string().valid(...DisputeSettlement.STATUSES),
});

const settlementUpdateSchema = Joi.object({
  type: Joi.string().valid('partial', 'full'),
  amount: Joi.number().positive().precision(2).allow(null),
  currency: Joi.string().length(3).uppercase().allow(null),
  terms: Joi.string().allow('', null),
  metadata: Joi.object().unknown(true),
  status: Joi.string().valid(...DisputeSettlement.STATUSES),
}).min(1);

const decisionSchema = Joi.object({
  outcome: Joi.string()
    .valid('resolved_for_claimant', 'resolved_for_respondent', 'split', 'escalated')
    .required(),
  award_amount: Joi.number().precision(2).allow(null),
  award_currency: Joi.string().length(3).uppercase().allow(null),
  summary: Joi.string().allow('', null),
  metadata: Joi.object().unknown(true),
  decided_at: Joi.date(),
  resolution_status: Joi.string().valid('resolved', 'closed', 'cancelled'),
  resolution_summary: Joi.string().allow('', null),
});

const decisionUpdateSchema = Joi.object({
  outcome: Joi.string().valid('resolved_for_claimant', 'resolved_for_respondent', 'split', 'escalated'),
  award_amount: Joi.number().precision(2).allow(null),
  award_currency: Joi.string().length(3).uppercase().allow(null),
  summary: Joi.string().allow('', null),
  metadata: Joi.object().unknown(true),
  decided_at: Joi.date(),
}).min(1);

const analyticsSchema = Joi.object({
  from: Joi.date(),
  to: Joi.date(),
  by: Joi.string().valid('day', 'week', 'month').default('day'),
  status: Joi.string(),
});

const list = async (req, res, next) => {
  try {
    const payload = await listSchema.validateAsync(req.query, { abortEarly: false });
    const result = await service.listDisputes(payload, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const payload = await createSchema.validateAsync(req.body, { abortEarly: false });
    if (payload.assigned_to && req.user.role !== 'admin') {
      throw new ApiError(403, 'Only admins can assign disputes on creation', 'FORBIDDEN');
    }
    const dispute = await service.createDispute(req.user, payload);
    await persistIdempotentResponse(req, res, { status: 201, body: dispute });
    res.status(201).json(dispute);
  } catch (error) {
    next(error);
  }
};

const get = async (req, res, next) => {
  try {
    const dispute = await service.getDispute(req.params.id, req.user, {
      expand: req.query.expand,
      includeDeleted: req.query.include === 'deleted',
    });
    res.json(dispute);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const payload = await updateSchema.validateAsync(req.body, { abortEarly: false });
    if (payload.assigned_to !== undefined && req.user.role !== 'admin') {
      throw new ApiError(403, 'Only admins can reassign disputes', 'FORBIDDEN');
    }
    const dispute = await service.updateDisputeStatus(req.params.id, req.user, payload);
    res.json(dispute);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await service.deleteDispute(req.params.id, req.user);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const listMessages = async (req, res, next) => {
  try {
    const payload = await listMessagesSchema.validateAsync(req.query, { abortEarly: false });
    const result = await service.listMessages(req.params.id, req.user, payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const postMessage = async (req, res, next) => {
  try {
    const payload = await messageSchema.validateAsync(req.body, { abortEarly: false });
    const message = await service.createMessage(req.params.id, req.user, payload);
    await persistIdempotentResponse(req, res, { status: 201, body: message });
    res.status(201).json(message);
  } catch (error) {
    next(error);
  }
};

const getMessage = async (req, res, next) => {
  try {
    const message = await service.getMessage(req.params.id, req.params.messageId, req.user, {
      includeDeleted: req.query.include === 'deleted',
    });
    res.json(message);
  } catch (error) {
    next(error);
  }
};

const updateMessage = async (req, res, next) => {
  try {
    const payload = await messageUpdateSchema.validateAsync(req.body, { abortEarly: false });
    if (payload.visibility === 'internal' && req.user.role !== 'admin') {
      throw new ApiError(403, 'Only admins can post internal messages', 'FORBIDDEN');
    }
    const message = await service.updateMessage(req.params.id, req.params.messageId, req.user, payload);
    res.json(message);
  } catch (error) {
    next(error);
  }
};

const deleteMessage = async (req, res, next) => {
  try {
    await service.deleteMessage(req.params.id, req.params.messageId, req.user);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const listEvidence = async (req, res, next) => {
  try {
    const payload = await listMessagesSchema.validateAsync(req.query, { abortEarly: false });
    const result = await service.listEvidence(req.params.id, req.user, payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const postEvidence = async (req, res, next) => {
  try {
    const payload = await evidenceSchema.validateAsync(req.body, { abortEarly: false });
    const evidence = await service.createEvidence(req.params.id, req.user, payload);
    await persistIdempotentResponse(req, res, { status: 201, body: evidence });
    res.status(201).json(evidence);
  } catch (error) {
    next(error);
  }
};

const getEvidence = async (req, res, next) => {
  try {
    const evidence = await service.getEvidence(req.params.id, req.params.evidenceId, req.user, {
      includeDeleted: req.query.include === 'deleted',
    });
    res.json(evidence);
  } catch (error) {
    next(error);
  }
};

const updateEvidence = async (req, res, next) => {
  try {
    const payload = await evidenceUpdateSchema.validateAsync(req.body, { abortEarly: false });
    const evidence = await service.updateEvidence(req.params.id, req.params.evidenceId, req.user, payload);
    res.json(evidence);
  } catch (error) {
    next(error);
  }
};

const deleteEvidence = async (req, res, next) => {
  try {
    await service.deleteEvidence(req.params.id, req.params.evidenceId, req.user);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const postSettlement = async (req, res, next) => {
  try {
    const payload = await settlementSchema.validateAsync(req.body, { abortEarly: false });
    const settlement = await service.createSettlement(req.params.id, req.user, payload);
    await persistIdempotentResponse(req, res, { status: 201, body: settlement });
    res.status(201).json(settlement);
  } catch (error) {
    next(error);
  }
};

const listSettlements = async (req, res, next) => {
  try {
    const payload = await listMessagesSchema.validateAsync(req.query, { abortEarly: false });
    const settlements = await service.listSettlements(req.params.id, req.user, payload);
    res.json(settlements);
  } catch (error) {
    next(error);
  }
};

const getSettlement = async (req, res, next) => {
  try {
    const settlement = await service.getSettlement(req.params.id, req.params.settlementId, req.user, {
      includeDeleted: req.query.include === 'deleted',
    });
    res.json(settlement);
  } catch (error) {
    next(error);
  }
};

const updateSettlement = async (req, res, next) => {
  try {
    const payload = await settlementUpdateSchema.validateAsync(req.body, { abortEarly: false });
    const settlement = await service.updateSettlement(req.params.id, req.params.settlementId, req.user, payload);
    res.json(settlement);
  } catch (error) {
    next(error);
  }
};

const deleteSettlement = async (req, res, next) => {
  try {
    await service.deleteSettlement(req.params.id, req.params.settlementId, req.user);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const postDecision = async (req, res, next) => {
  try {
    const payload = await decisionSchema.validateAsync(req.body, { abortEarly: false });
    if (req.user.role !== 'admin') {
      throw new ApiError(403, 'Only admins can record dispute decisions', 'FORBIDDEN');
    }
    const decision = await service.recordDecision(req.params.id, req.user, payload);
    await persistIdempotentResponse(req, res, { status: 201, body: decision });
    res.status(201).json(decision);
  } catch (error) {
    next(error);
  }
};

const listDecisions = async (req, res, next) => {
  try {
    const decisions = await service.listDecisions(req.params.id, req.user);
    res.json(decisions);
  } catch (error) {
    next(error);
  }
};

const getDecision = async (req, res, next) => {
  try {
    const decision = await service.getDecision(req.params.id, req.params.decisionId, req.user);
    res.json(decision);
  } catch (error) {
    next(error);
  }
};

const updateDecision = async (req, res, next) => {
  try {
    const payload = await decisionUpdateSchema.validateAsync(req.body, { abortEarly: false });
    const decision = await service.updateDecision(req.params.id, req.params.decisionId, req.user, payload);
    res.json(decision);
  } catch (error) {
    next(error);
  }
};

const deleteDecision = async (req, res, next) => {
  try {
    await service.deleteDecision(req.params.id, req.params.decisionId, req.user);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const analytics = async (req, res, next) => {
  try {
    const payload = await analyticsSchema.validateAsync(req.query, { abortEarly: false });
    const result = await service.analytics(payload, req.user);
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
  listMessages,
  postMessage,
  getMessage,
  updateMessage,
  deleteMessage,
  listEvidence,
  postEvidence,
  getEvidence,
  updateEvidence,
  deleteEvidence,
  postSettlement,
  listSettlements,
  getSettlement,
  updateSettlement,
  deleteSettlement,
  postDecision,
  listDecisions,
  getDecision,
  updateDecision,
  deleteDecision,
  analytics,
};
