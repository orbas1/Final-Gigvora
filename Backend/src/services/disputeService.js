const { Op, fn, col } = require('sequelize');
const dayjs = require('dayjs');
const { Dispute, DisputeMessage, DisputeEvidence, DisputeSettlement, DisputeDecision, FileAsset } = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { buildPagination, encodeCursor } = require('../utils/pagination');
const { aggregateByPeriod } = require('../utils/analytics');

const STATUS_TRANSITIONS = {
  open: ['under_review', 'cancelled'],
  under_review: ['action_required', 'resolved', 'closed', 'cancelled'],
  action_required: ['under_review', 'resolved', 'closed', 'cancelled'],
  resolved: ['closed'],
  closed: [],
  cancelled: [],
};

const ensureDisputeAccess = (dispute, actor) => {
  if (!actor) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }
  if (dispute.deleted_at && actor.role !== 'admin') {
    throw new ApiError(404, 'Dispute not found', 'DISPUTE_NOT_FOUND');
  }
  if (actor.role === 'admin') return;
  if (dispute.created_by === actor.id) return;
  if (dispute.assigned_to && dispute.assigned_to === actor.id) return;
  throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
};

const fetchDisputeOrThrow = async (disputeId, { includeDeleted = false } = {}) => {
  const dispute = await Dispute.findByPk(disputeId, { paranoid: !includeDeleted });
  if (!dispute) {
    throw new ApiError(404, 'Dispute not found', 'DISPUTE_NOT_FOUND');
  }
  return dispute;
};

const resolveIncludes = (expand = '') => {
  const expansions = String(expand || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const includes = [];
  if (expansions.includes('messages')) {
    includes.push({
      association: 'messages',
      attributes: ['id', 'dispute_id', 'user_id', 'body', 'attachments', 'visibility', 'created_at'],
      separate: true,
      order: [['created_at', 'DESC']],
      limit: 20,
    });
  }
  if (expansions.includes('evidence')) {
    includes.push({
      association: 'evidence',
      attributes: ['id', 'dispute_id', 'user_id', 'kind', 'title', 'description', 'file_id', 'metadata', 'created_at'],
      include: [{ association: 'file', attributes: ['id', 'filename', 'mime_type', 'size_bytes'] }],
      separate: true,
      order: [['created_at', 'DESC']],
      limit: 20,
    });
  }
  if (expansions.includes('settlements')) {
    includes.push({
      association: 'settlements',
      attributes: [
        'id',
        'dispute_id',
        'proposed_by',
        'type',
        'amount',
        'currency',
        'terms',
        'status',
        'responded_at',
        'metadata',
        'created_at',
      ],
      separate: true,
      order: [['created_at', 'DESC']],
    });
  }
  if (expansions.includes('decisions')) {
    includes.push({
      association: 'decisions',
      attributes: ['id', 'dispute_id', 'decided_by', 'outcome', 'award_amount', 'award_currency', 'summary', 'metadata', 'decided_at'],
      separate: true,
      order: [['decided_at', 'DESC']],
      limit: 5,
    });
  }
  if (expansions.includes('participants')) {
    includes.push({ association: 'creator', attributes: ['id', 'email', 'role'] });
    includes.push({ association: 'assignee', attributes: ['id', 'email', 'role'] });
  }

  return includes;
};

const buildVisibilityWhere = (actor) => {
  if (actor.role === 'admin') return {};
  return { visibility: 'party' };
};

const baseScopeForUser = (actor) => {
  if (actor.role === 'admin') {
    return {};
  }
  return {
    [Op.or]: [{ created_by: actor.id }, { assigned_to: actor.id }],
  };
};

const listDisputes = async (query, actor) => {
  const pagination = buildPagination(query, ['created_at', 'updated_at']);
  const scope = baseScopeForUser(actor);
  const where = {};
  if (scope[Op.or]) {
    where[Op.or] = [...scope[Op.or]];
  }
  Object.entries(scope)
    .filter(([key]) => key !== Op.or)
    .forEach(([key, value]) => {
      where[key] = value;
    });
  const includeDeleted = query.include === 'deleted' && actor.role === 'admin';

  if (query.entity_type) {
    where.entity_type = query.entity_type;
  }

  if (query.status) {
    const statuses = Array.isArray(query.status)
      ? query.status
      : String(query.status)
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean);
    if (statuses.length) {
      where.status = { [Op.in]: statuses };
    }
  }

  if (query.q) {
    const likeValue = `%${query.q}%`;
    const orList = where[Op.or] ? [...where[Op.or]] : [];
    orList.push({ entity_ref: { [Op.like]: likeValue } }, { reason: { [Op.like]: likeValue } });
    where[Op.or] = orList;
  }

  if (pagination.cursorValue) {
    where[pagination.sortField] = { [pagination.cursorOperator]: pagination.cursorValue };
  }

  const attributes = query.fields
    ? Array.from(
        new Set(
          String(query.fields)
            .split(',')
            .map((field) => field.trim())
            .filter(Boolean)
            .concat('id')
        )
      )
    : undefined;

  const includes = resolveIncludes(query.expand);

  const { rows, count } = await Dispute.findAndCountAll({
    where,
    attributes,
    include: includes,
    limit: pagination.limit,
    order: pagination.order,
    paranoid: !includeDeleted,
    distinct: true,
  });

  const nextCursor =
    rows.length === pagination.limit ? encodeCursor(rows[rows.length - 1][pagination.sortField]) : null;

  let analytics = undefined;
  if (String(query.analytics).toLowerCase() === 'true') {
    const statusCounts = await Dispute.findAll({
      attributes: ['status', [fn('COUNT', col('status')), 'count']],
      where,
      paranoid: !includeDeleted,
      group: ['status'],
      raw: true,
    });
    analytics = statusCounts.reduce(
      (acc, row) => ({
        ...acc,
        totals: { ...acc.totals, [row.status]: Number(row.count) },
        total: acc.total + Number(row.count),
      }),
      { totals: {}, total: 0 }
    );
  }

  return {
    data: rows,
    total: count,
    next_cursor: nextCursor,
    analytics,
  };
};

const createDispute = async (actor, payload) => {
  const dispute = await Dispute.create({
    entity_type: payload.entity_type,
    entity_ref: payload.entity_ref,
    reason: payload.reason,
    details: payload.details,
    status: 'open',
    created_by: actor.id,
    assigned_to: payload.assigned_to && actor.role === 'admin' ? payload.assigned_to : null,
    metadata: payload.metadata || null,
  });
  return dispute;
};

const getDispute = async (id, actor, options = {}) => {
  const includeDeleted = options.includeDeleted && actor.role === 'admin';
  const dispute = await Dispute.findByPk(id, {
    include: resolveIncludes(options.expand),
    paranoid: !includeDeleted,
  });
  if (!dispute) {
    throw new ApiError(404, 'Dispute not found', 'DISPUTE_NOT_FOUND');
  }
  ensureDisputeAccess(dispute, actor);
  return dispute;
};

const updateDisputeStatus = async (id, actor, payload) => {
  const dispute = await Dispute.findByPk(id, { paranoid: false });
  if (!dispute) {
    throw new ApiError(404, 'Dispute not found', 'DISPUTE_NOT_FOUND');
  }
  ensureDisputeAccess(dispute, actor);

  if (payload.status) {
    const allowed = STATUS_TRANSITIONS[dispute.status] || [];
    if (!allowed.includes(payload.status) && dispute.status !== payload.status) {
      throw new ApiError(400, `Status transition from ${dispute.status} to ${payload.status} is not allowed`, 'INVALID_TRANSITION');
    }
    dispute.status = payload.status;
    if (['resolved', 'closed', 'cancelled'].includes(payload.status)) {
      dispute.closed_at = new Date();
    } else if (!['resolved', 'closed', 'cancelled'].includes(dispute.status)) {
      dispute.closed_at = null;
    }
  }

  if (payload.assigned_to !== undefined && actor.role === 'admin') {
    dispute.assigned_to = payload.assigned_to || null;
  }

  if (payload.resolution_summary !== undefined) {
    dispute.resolution_summary = payload.resolution_summary;
  }

  await dispute.save();
  return dispute;
};

const deleteDispute = async (id, actor) => {
  const dispute = await Dispute.findByPk(id, { paranoid: false });
  if (!dispute) {
    throw new ApiError(404, 'Dispute not found', 'DISPUTE_NOT_FOUND');
  }
  ensureDisputeAccess(dispute, actor);
  if (actor.role !== 'admin' && dispute.created_by !== actor.id) {
    throw new ApiError(403, 'Only administrators or the creator can delete disputes', 'FORBIDDEN');
  }
  await dispute.destroy();
  return { success: true };
};

const listMessages = async (disputeId, actor, query = {}) => {
  const dispute = await fetchDisputeOrThrow(disputeId, { includeDeleted: true });
  ensureDisputeAccess(dispute, actor);

  const pagination = buildPagination(query, ['created_at']);
  const where = { dispute_id: disputeId, ...buildVisibilityWhere(actor) };
  if (pagination.cursorValue) {
    where.created_at = { [pagination.cursorOperator]: pagination.cursorValue };
  }

  const { rows, count } = await DisputeMessage.findAndCountAll({
    where,
    include: [{ association: 'author', attributes: ['id', 'email'] }],
    limit: pagination.limit,
    order: pagination.order,
    paranoid: actor.role === 'admin' ? query.include !== 'deleted' : true,
  });

  const nextCursor =
    rows.length === pagination.limit ? encodeCursor(rows[rows.length - 1].created_at) : null;

  return { data: rows, total: count, next_cursor: nextCursor };
};

const createMessage = async (disputeId, actor, payload) => {
  const dispute = await fetchDisputeOrThrow(disputeId);
  ensureDisputeAccess(dispute, actor);

  if (payload.visibility === 'internal' && actor.role !== 'admin') {
    throw new ApiError(403, 'Only admins can post internal messages', 'FORBIDDEN');
  }

  const message = await DisputeMessage.create({
    dispute_id: disputeId,
    user_id: actor.id,
    body: payload.body,
    attachments: payload.attachments || null,
    visibility: payload.visibility || 'party',
  });
  return message;
};

const getMessage = async (disputeId, messageId, actor, options = {}) => {
  const dispute = await fetchDisputeOrThrow(disputeId, { includeDeleted: true });
  ensureDisputeAccess(dispute, actor);

  const includeDeleted = options.includeDeleted && actor.role === 'admin';
  const message = await DisputeMessage.findOne({
    where: { id: messageId, dispute_id: disputeId, ...(actor.role === 'admin' ? {} : buildVisibilityWhere(actor)) },
    paranoid: !includeDeleted,
    include: [{ association: 'author', attributes: ['id', 'email'] }],
  });

  if (!message) {
    throw new ApiError(404, 'Message not found', 'DISPUTE_MESSAGE_NOT_FOUND');
  }

  return message;
};

const updateMessage = async (disputeId, messageId, actor, payload) => {
  const message = await getMessage(disputeId, messageId, actor, { includeDeleted: true });
  if (message.deleted_at && actor.role !== 'admin') {
    throw new ApiError(404, 'Message not found', 'DISPUTE_MESSAGE_NOT_FOUND');
  }

  if (actor.role !== 'admin' && message.user_id !== actor.id) {
    throw new ApiError(403, 'Only the author can edit this message', 'FORBIDDEN');
  }

  if (payload.body !== undefined) {
    message.body = payload.body;
  }
  if (payload.attachments !== undefined) {
    message.attachments = payload.attachments;
  }
  if (payload.visibility !== undefined) {
    if (payload.visibility === 'internal' && actor.role !== 'admin') {
      throw new ApiError(403, 'Only admins can post internal messages', 'FORBIDDEN');
    }
    message.visibility = payload.visibility;
  }

  await message.save();
  return message;
};

const deleteMessage = async (disputeId, messageId, actor) => {
  const message = await getMessage(disputeId, messageId, actor, { includeDeleted: true });
  if (actor.role !== 'admin' && message.user_id !== actor.id) {
    throw new ApiError(403, 'Only the author can delete this message', 'FORBIDDEN');
  }
  await message.destroy();
  return { success: true };
};

const listEvidence = async (disputeId, actor, query = {}) => {
  const dispute = await fetchDisputeOrThrow(disputeId, { includeDeleted: true });
  ensureDisputeAccess(dispute, actor);

  const pagination = buildPagination(query, ['created_at']);
  const where = { dispute_id: disputeId };
  if (pagination.cursorValue) {
    where.created_at = { [pagination.cursorOperator]: pagination.cursorValue };
  }

  const { rows, count } = await DisputeEvidence.findAndCountAll({
    where,
    include: [
      { association: 'uploader', attributes: ['id', 'email'] },
      { association: 'file', attributes: ['id', 'filename', 'mime_type', 'size_bytes'] },
    ],
    limit: pagination.limit,
    order: pagination.order,
    paranoid: actor.role === 'admin' ? query.include !== 'deleted' : true,
  });

  const nextCursor =
    rows.length === pagination.limit ? encodeCursor(rows[rows.length - 1].created_at) : null;

  return { data: rows, total: count, next_cursor: nextCursor };
};

const createEvidence = async (disputeId, actor, payload) => {
  const dispute = await fetchDisputeOrThrow(disputeId);
  ensureDisputeAccess(dispute, actor);

  if (payload.file_id) {
    const file = await FileAsset.findByPk(payload.file_id);
    if (!file) {
      throw new ApiError(404, 'Referenced file was not found', 'FILE_NOT_FOUND');
    }
  }

  const evidence = await DisputeEvidence.create({
    dispute_id: disputeId,
    user_id: actor.id,
    kind: payload.kind,
    title: payload.title,
    description: payload.description,
    file_id: payload.file_id || null,
    metadata: payload.metadata || null,
  });
  return evidence;
};

const getEvidence = async (disputeId, evidenceId, actor, options = {}) => {
  const dispute = await fetchDisputeOrThrow(disputeId, { includeDeleted: true });
  ensureDisputeAccess(dispute, actor);

  const includeDeleted = options.includeDeleted && actor.role === 'admin';
  const evidence = await DisputeEvidence.findOne({
    where: { id: evidenceId, dispute_id: disputeId },
    paranoid: !includeDeleted,
    include: [
      { association: 'uploader', attributes: ['id', 'email'] },
      { association: 'file', attributes: ['id', 'filename', 'mime_type', 'size_bytes'] },
    ],
  });

  if (!evidence) {
    throw new ApiError(404, 'Evidence not found', 'DISPUTE_EVIDENCE_NOT_FOUND');
  }

  return evidence;
};

const updateEvidence = async (disputeId, evidenceId, actor, payload) => {
  const evidence = await getEvidence(disputeId, evidenceId, actor, { includeDeleted: true });
  if (evidence.deleted_at && actor.role !== 'admin') {
    throw new ApiError(404, 'Evidence not found', 'DISPUTE_EVIDENCE_NOT_FOUND');
  }

  if (actor.role !== 'admin' && evidence.user_id !== actor.id) {
    throw new ApiError(403, 'Only the uploader can edit this evidence', 'FORBIDDEN');
  }

  if (payload.kind !== undefined) {
    evidence.kind = payload.kind;
  }
  if (payload.title !== undefined) {
    evidence.title = payload.title;
  }
  if (payload.description !== undefined) {
    evidence.description = payload.description;
  }
  if (payload.file_id !== undefined) {
    if (payload.file_id) {
      const file = await FileAsset.findByPk(payload.file_id);
      if (!file) {
        throw new ApiError(404, 'Referenced file was not found', 'FILE_NOT_FOUND');
      }
    }
    evidence.file_id = payload.file_id || null;
  }
  if (payload.metadata !== undefined) {
    evidence.metadata = payload.metadata;
  }

  await evidence.save();
  return evidence;
};

const deleteEvidence = async (disputeId, evidenceId, actor) => {
  const evidence = await getEvidence(disputeId, evidenceId, actor, { includeDeleted: true });
  if (actor.role !== 'admin' && evidence.user_id !== actor.id) {
    throw new ApiError(403, 'Only the uploader can delete this evidence', 'FORBIDDEN');
  }
  await evidence.destroy();
  return { success: true };
};

const createSettlement = async (disputeId, actor, payload) => {
  const dispute = await fetchDisputeOrThrow(disputeId);
  ensureDisputeAccess(dispute, actor);

  const settlement = await DisputeSettlement.create({
    dispute_id: disputeId,
    proposed_by: actor.id,
    type: payload.type,
    amount: payload.amount,
    currency: payload.currency,
    terms: payload.terms,
    metadata: payload.metadata || null,
  });

  if (payload.status && DisputeSettlement.STATUSES.includes(payload.status)) {
    settlement.status = payload.status;
    settlement.responded_at = payload.status === 'proposed' ? null : new Date();
    await settlement.save();
  }

  return settlement;
};

const listSettlements = async (disputeId, actor, query = {}) => {
  const dispute = await fetchDisputeOrThrow(disputeId, { includeDeleted: true });
  ensureDisputeAccess(dispute, actor);

  const pagination = buildPagination(query, ['created_at']);
  const where = { dispute_id: disputeId };
  if (pagination.cursorValue) {
    where.created_at = { [pagination.cursorOperator]: pagination.cursorValue };
  }

  const { rows, count } = await DisputeSettlement.findAndCountAll({
    where,
    include: [{ association: 'proposer', attributes: ['id', 'email'] }],
    limit: pagination.limit,
    order: pagination.order,
    paranoid: actor.role === 'admin' ? query.include !== 'deleted' : true,
  });

  const nextCursor =
    rows.length === pagination.limit ? encodeCursor(rows[rows.length - 1].created_at) : null;

  return { data: rows, total: count, next_cursor: nextCursor };
};

const getSettlement = async (disputeId, settlementId, actor, options = {}) => {
  const dispute = await fetchDisputeOrThrow(disputeId, { includeDeleted: true });
  ensureDisputeAccess(dispute, actor);

  const includeDeleted = options.includeDeleted && actor.role === 'admin';
  const settlement = await DisputeSettlement.findOne({
    where: { id: settlementId, dispute_id: disputeId },
    paranoid: !includeDeleted,
    include: [{ association: 'proposer', attributes: ['id', 'email'] }],
  });

  if (!settlement) {
    throw new ApiError(404, 'Settlement not found', 'DISPUTE_SETTLEMENT_NOT_FOUND');
  }

  return settlement;
};

const updateSettlement = async (disputeId, settlementId, actor, payload) => {
  const settlement = await getSettlement(disputeId, settlementId, actor, { includeDeleted: true });
  if (settlement.deleted_at && actor.role !== 'admin') {
    throw new ApiError(404, 'Settlement not found', 'DISPUTE_SETTLEMENT_NOT_FOUND');
  }

  if (actor.role !== 'admin' && settlement.proposed_by !== actor.id) {
    throw new ApiError(403, 'Only the proposer can update this settlement', 'FORBIDDEN');
  }

  if (payload.type !== undefined) {
    settlement.type = payload.type;
  }
  if (payload.amount !== undefined) {
    settlement.amount = payload.amount;
  }
  if (payload.currency !== undefined) {
    settlement.currency = payload.currency;
  }
  if (payload.terms !== undefined) {
    settlement.terms = payload.terms;
  }
  if (payload.metadata !== undefined) {
    settlement.metadata = payload.metadata;
  }
  if (payload.status !== undefined) {
    if (!DisputeSettlement.STATUSES.includes(payload.status)) {
      throw new ApiError(400, 'Invalid settlement status', 'INVALID_STATUS');
    }
    settlement.status = payload.status;
    settlement.responded_at = payload.status === 'proposed' ? null : new Date();
  }

  await settlement.save();
  return settlement;
};

const deleteSettlement = async (disputeId, settlementId, actor) => {
  const settlement = await getSettlement(disputeId, settlementId, actor, { includeDeleted: true });
  if (actor.role !== 'admin' && settlement.proposed_by !== actor.id) {
    throw new ApiError(403, 'Only the proposer can delete this settlement', 'FORBIDDEN');
  }
  await settlement.destroy();
  return { success: true };
};

const recordDecision = async (disputeId, actor, payload) => {
  if (actor.role !== 'admin') {
    throw new ApiError(403, 'Only administrators may record a decision', 'FORBIDDEN');
  }

  const dispute = await fetchDisputeOrThrow(disputeId);

  const decision = await DisputeDecision.create({
    dispute_id: disputeId,
    decided_by: actor.id,
    outcome: payload.outcome,
    award_amount: payload.award_amount,
    award_currency: payload.award_currency,
    summary: payload.summary,
    metadata: payload.metadata || null,
    decided_at: payload.decided_at ? dayjs(payload.decided_at).toDate() : new Date(),
  });

  if (payload.resolution_status) {
    const allowedStatuses = ['resolved', 'closed', 'cancelled'];
    if (!allowedStatuses.includes(payload.resolution_status)) {
      throw new ApiError(400, 'resolution_status must be resolved, closed or cancelled', 'INVALID_STATUS');
    }
    dispute.status = payload.resolution_status;
    dispute.closed_at = new Date();
  } else if (dispute.status !== 'closed') {
    dispute.status = 'resolved';
    dispute.closed_at = new Date();
  }

  if (payload.resolution_summary) {
    dispute.resolution_summary = payload.resolution_summary;
  }

  await dispute.save();

  return decision;
};

const listDecisions = async (disputeId, actor) => {
  const dispute = await fetchDisputeOrThrow(disputeId, { includeDeleted: true });
  ensureDisputeAccess(dispute, actor);

  const decisions = await DisputeDecision.findAll({
    where: { dispute_id: disputeId },
    include: [{ association: 'decider', attributes: ['id', 'email'] }],
    order: [['decided_at', 'DESC']],
  });

  return decisions;
};

const getDecision = async (disputeId, decisionId, actor) => {
  const dispute = await fetchDisputeOrThrow(disputeId, { includeDeleted: true });
  ensureDisputeAccess(dispute, actor);

  const decision = await DisputeDecision.findOne({
    where: { id: decisionId, dispute_id: disputeId },
    include: [{ association: 'decider', attributes: ['id', 'email'] }],
  });

  if (!decision) {
    throw new ApiError(404, 'Decision not found', 'DISPUTE_DECISION_NOT_FOUND');
  }

  return decision;
};

const updateDecision = async (disputeId, decisionId, actor, payload) => {
  if (actor.role !== 'admin') {
    throw new ApiError(403, 'Only administrators may update decisions', 'FORBIDDEN');
  }

  const decision = await getDecision(disputeId, decisionId, actor);

  if (payload.outcome !== undefined) {
    decision.outcome = payload.outcome;
  }
  if (payload.award_amount !== undefined) {
    decision.award_amount = payload.award_amount;
  }
  if (payload.award_currency !== undefined) {
    decision.award_currency = payload.award_currency;
  }
  if (payload.summary !== undefined) {
    decision.summary = payload.summary;
  }
  if (payload.metadata !== undefined) {
    decision.metadata = payload.metadata;
  }
  if (payload.decided_at !== undefined) {
    decision.decided_at = payload.decided_at ? dayjs(payload.decided_at).toDate() : new Date();
  }

  await decision.save();
  return decision;
};

const deleteDecision = async (disputeId, decisionId, actor) => {
  if (actor.role !== 'admin') {
    throw new ApiError(403, 'Only administrators may delete decisions', 'FORBIDDEN');
  }

  const decision = await getDecision(disputeId, decisionId, actor);
  await decision.destroy();
  return { success: true };
};

const analytics = async ({ from, to, by = 'day', status }, actor) => {
  if (actor.role !== 'admin') {
    throw new ApiError(403, 'Only administrators may view dispute analytics', 'FORBIDDEN');
  }

  const extraWhere = [];
  const replacements = {};
  if (status) {
    const statuses = String(status)
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (statuses.length) {
      const queryGenerator = Dispute.sequelize.getQueryInterface().queryGenerator;
      const table = queryGenerator.quoteTable(Dispute.getTableName());
      const statusColumn = `${table}.${queryGenerator.quoteIdentifier('status')}`;
      extraWhere.push(`${statusColumn} IN (:statuses)`);
      replacements.statuses = statuses;
    }
  }

  const buckets = await aggregateByPeriod(Dispute, 'created_at', {
    granularity: by,
    from,
    to,
    includeDeleted: false,
    extraWhere,
    replacements,
  });

  const totals = await Dispute.findAll({
    attributes: ['status', [fn('COUNT', col('status')), 'count']],
    raw: true,
    group: ['status'],
  });

  return {
    from,
    to,
    by,
    buckets,
    totals: totals.reduce((acc, row) => ({ ...acc, [row.status]: Number(row.count) }), {}),
  };
};

module.exports = {
  listDisputes,
  createDispute,
  getDispute,
  updateDisputeStatus,
  deleteDispute,
  listMessages,
  createMessage,
  getMessage,
  updateMessage,
  deleteMessage,
  listEvidence,
  createEvidence,
  getEvidence,
  updateEvidence,
  deleteEvidence,
  createSettlement,
  listSettlements,
  getSettlement,
  updateSettlement,
  deleteSettlement,
  recordDecision,
  listDecisions,
  getDecision,
  updateDecision,
  deleteDecision,
  analytics,
};
