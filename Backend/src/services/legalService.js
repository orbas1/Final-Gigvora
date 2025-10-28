const { Op } = require('sequelize');
const dayjs = require('dayjs');
const { LegalDocument, LegalConsent, User } = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { buildPagination, encodeCursor } = require('../utils/pagination');
const { persistIdempotentResponse } = require('../middleware/idempotency');

const BOOLEAN_TRUE = new Set(['true', '1', 'yes']);

const toBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (BOOLEAN_TRUE.has(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
  }
  return false;
};

const parseListParam = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap((entry) => String(entry).split(',')).map((entry) => entry.trim()).filter(Boolean);
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const pickFields = (entity, allowedFields, requested = []) => {
  if (!requested.length) {
    return entity;
  }
  const selection = {};
  requested.forEach((field) => {
    if (allowedFields.has(field) && entity[field] !== undefined) {
      selection[field] = entity[field];
    }
  });
  return Object.keys(selection).length ? selection : entity;
};

const allowedDocumentFields = new Set([
  'id',
  'slug',
  'title',
  'summary',
  'content',
  'version',
  'status',
  'effective_at',
  'published_at',
  'metadata',
  'created_at',
  'updated_at',
  'analytics',
]);

const documentForResponse = async ({ document, analyticsRequested }) => {
  const data = document.toJSON();
  if (!analyticsRequested) {
    return data;
  }
  const [totalConsents, uniqueConsentingUsers, revokedConsents] = await Promise.all([
    LegalConsent.count({ where: { document_id: document.id } }),
    LegalConsent.count({ where: { document_id: document.id }, distinct: true, col: 'user_id' }),
    LegalConsent.count({ where: { document_id: document.id, revoked_at: { [Op.not]: null } } }),
  ]);
  return {
    ...data,
    analytics: {
      total_consents: totalConsents,
      unique_users: uniqueConsentingUsers,
      revoked_consents: revokedConsents,
    },
  };
};

const applyCursorCondition = (where, pagination) => {
  if (pagination.cursorValue === undefined || pagination.cursorValue === null) {
    return where;
  }

  const existing = where[pagination.sortField];
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    where[pagination.sortField] = { ...existing, [pagination.cursorOperator]: pagination.cursorValue };
  } else {
    where[pagination.sortField] = { [pagination.cursorOperator]: pagination.cursorValue };
  }
  return where;
};

const getDocumentBySlug = async ({ slug, version, includeDraft, analytics }) => {
  const where = { slug };
  if (version) {
    where.version = version;
  }
  if (!includeDraft) {
    where.status = 'published';
  }

  const document = await LegalDocument.findOne({
    where,
    order: [
      ['effective_at', 'DESC'],
      ['created_at', 'DESC'],
    ],
  });

  if (!document) {
    throw new ApiError(404, 'Legal document not found', 'LEGAL_DOCUMENT_NOT_FOUND');
  }

  return documentForResponse({ document, analyticsRequested: analytics });
};

const ensureDocumentAccess = (user, includeDraft) => {
  if (includeDraft && user?.role !== 'admin') {
    throw new ApiError(403, 'Draft legal documents can only be accessed by administrators', 'FORBIDDEN');
  }
};

const listConsents = async (user, query = {}) => {
  if (!user) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  const {
    document_slug: documentSlug,
    document_version: documentVersion,
    user_id: queryUserId,
    from,
    to,
    include,
    expand,
    analytics,
  } = query;

  const pagination = buildPagination(query, ['created_at', 'consented_at']);
  const baseWhere = {};

  if (documentSlug) {
    baseWhere.document_slug = documentSlug;
  }
  if (documentVersion) {
    baseWhere.document_version = documentVersion;
  }

  if (from || to) {
    baseWhere.consented_at = {};
    if (from) {
      const fromDate = dayjs(from);
      if (!fromDate.isValid()) {
        throw new ApiError(400, 'Invalid from date provided', 'INVALID_QUERY');
      }
      baseWhere.consented_at[Op.gte] = fromDate.toDate();
    }
    if (to) {
      const toDate = dayjs(to);
      if (!toDate.isValid()) {
        throw new ApiError(400, 'Invalid to date provided', 'INVALID_QUERY');
      }
      baseWhere.consented_at[Op.lte] = toDate.toDate();
    }
  }

  const isAdmin = user.role === 'admin';
  if (queryUserId) {
    if (!isAdmin && queryUserId !== user.id) {
      throw new ApiError(403, 'You are not permitted to inspect other users\' consent records', 'FORBIDDEN');
    }
    baseWhere.user_id = queryUserId;
  } else if (!isAdmin) {
    baseWhere.user_id = user.id;
  }

  const expandList = parseListParam(expand);
  const includeModels = [];
  if (expandList.includes('document')) {
    includeModels.push({
      model: LegalDocument,
      as: 'document',
      attributes: ['id', 'slug', 'title', 'version', 'effective_at', 'status'],
      paranoid: false,
    });
  }
  if (expandList.includes('user') && isAdmin) {
    includeModels.push({ model: User, as: 'user', attributes: ['id', 'email', 'role'] });
  }

  const paranoid = !(include === 'deleted' && isAdmin);

  const pageWhere = { ...baseWhere };
  applyCursorCondition(pageWhere, pagination);

  const records = await LegalConsent.findAll({
    where: pageWhere,
    include: includeModels,
    order: pagination.order,
    limit: pagination.limit + 1,
    paranoid,
  });

  const hasNext = records.length > pagination.limit;
  const sliced = hasNext ? records.slice(0, -1) : records;
  const lastRecord = sliced[sliced.length - 1];
  const nextCursor = lastRecord ? encodeCursor(lastRecord.get(pagination.sortField)) : null;

  let analyticsPayload;
  if (toBoolean(analytics)) {
    const [totalConsents, uniqueUsers, revoked] = await Promise.all([
      LegalConsent.count({ where: baseWhere, paranoid }),
      LegalConsent.count({ where: baseWhere, paranoid, distinct: true, col: 'user_id' }),
      LegalConsent.count({ where: { ...baseWhere, revoked_at: { [Op.not]: null } }, paranoid }),
    ]);
    analyticsPayload = {
      total_consents: totalConsents,
      unique_users: uniqueUsers,
      revoked_consents: revoked,
    };
  }

  return {
    data: sliced.map((record) => record.toJSON()),
    next_cursor: hasNext ? nextCursor : null,
    analytics: analyticsPayload,
  };
};

const createConsent = async (req, res, user, payload) => {
  if (!user) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  const { document_slug: documentSlug, document_version: documentVersion, consented_at: consentedAt, metadata } = payload;

  if (!documentSlug) {
    throw new ApiError(400, 'document_slug is required', 'INVALID_PAYLOAD');
  }

  const document = await LegalDocument.findOne({
    where: {
      slug: documentSlug,
      ...(documentVersion ? { version: documentVersion } : {}),
      status: 'published',
    },
    order: [
      ['effective_at', 'DESC'],
      ['created_at', 'DESC'],
    ],
  });

  if (!document) {
    throw new ApiError(404, 'The requested legal document could not be found', 'LEGAL_DOCUMENT_NOT_FOUND');
  }

  const consentDate = consentedAt ? dayjs(consentedAt) : dayjs();
  if (!consentDate.isValid()) {
    throw new ApiError(400, 'consented_at must be a valid datetime', 'INVALID_PAYLOAD');
  }

  const consent = await LegalConsent.create({
    user_id: user.id,
    document_id: document.id,
    document_slug: document.slug,
    document_version: document.version,
    consented_at: consentDate.toDate(),
    metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
  });

  const response = consent.toJSON();
  await persistIdempotentResponse(req, res, { status: 201, body: response });
  return response;
};

const getConsent = async (user, id, query = {}) => {
  if (!user) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }
  const paranoid = !(query.include === 'deleted' && user.role === 'admin');
  const expandList = parseListParam(query.expand);
  const includeModels = [];
  if (expandList.includes('document')) {
    includeModels.push({
      model: LegalDocument,
      as: 'document',
      attributes: ['id', 'slug', 'title', 'version', 'effective_at', 'status'],
      paranoid: false,
    });
  }
  if (expandList.includes('user') && user.role === 'admin') {
    includeModels.push({ model: User, as: 'user', attributes: ['id', 'email', 'role'] });
  }

  const consent = await LegalConsent.findByPk(id, { include: includeModels, paranoid });
  if (!consent) {
    throw new ApiError(404, 'Consent record not found', 'CONSENT_NOT_FOUND');
  }
  if (user.role !== 'admin' && consent.user_id !== user.id) {
    throw new ApiError(403, 'You are not permitted to view this consent record', 'FORBIDDEN');
  }
  return consent.toJSON();
};

const getDocument = async (user, slug, query = {}) => {
  const includeDraft = toBoolean(query.includeDraft || query.include_draft);
  ensureDocumentAccess(user, includeDraft);
  const analyticsRequested = toBoolean(query.analytics);
  const requestedFields = parseListParam(query.fields);
  const document = await getDocumentBySlug({ slug, version: query.version, includeDraft, analytics: analyticsRequested });
  return pickFields(document, allowedDocumentFields, requestedFields);
};

const ensureAdmin = (user) => {
  if (!user || user.role !== 'admin') {
    throw new ApiError(403, 'Administrator access required', 'FORBIDDEN');
  }
};

const normalizeDocumentPayload = (payload) => {
  const normalized = { ...payload };
  if (normalized.slug) {
    normalized.slug = normalized.slug.trim().toLowerCase();
  }
  if (normalized.title) {
    normalized.title = normalized.title.trim();
  }
  if (typeof normalized.summary === 'string') {
    normalized.summary = normalized.summary.trim();
    if (!normalized.summary.length) {
      normalized.summary = null;
    }
  }
  if (normalized.version) {
    normalized.version = normalized.version.trim();
  }
  if (normalized.status) {
    normalized.status = normalized.status.toLowerCase();
  }
  if (normalized.metadata && typeof normalized.metadata !== 'object') {
    delete normalized.metadata;
  }
  if (normalized.effective_at) {
    const effectiveAt = dayjs(normalized.effective_at);
    if (!effectiveAt.isValid()) {
      throw new ApiError(400, 'effective_at must be a valid datetime', 'INVALID_PAYLOAD');
    }
    normalized.effective_at = effectiveAt.toDate();
  }
  if (normalized.published_at) {
    const publishedAt = dayjs(normalized.published_at);
    if (!publishedAt.isValid()) {
      throw new ApiError(400, 'published_at must be a valid datetime', 'INVALID_PAYLOAD');
    }
    normalized.published_at = publishedAt.toDate();
  }
  return normalized;
};

const listDocuments = async (user, query = {}) => {
  ensureAdmin(user);

  const pagination = buildPagination(query, ['effective_at', 'created_at', 'title']);
  const baseWhere = {};

  if (query.status) {
    baseWhere.status = query.status;
  }
  if (query.slug) {
    baseWhere.slug = query.slug;
  }
  if (query.version) {
    baseWhere.version = query.version;
  }
  if (query.q) {
    const pattern = `%${query.q}%`;
    const likeOperator = LegalDocument.sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like;
    baseWhere[Op.or] = [{ title: { [likeOperator]: pattern } }, { summary: { [likeOperator]: pattern } }, { slug: { [likeOperator]: pattern } }];
  }

  const paranoid = !(query.include === 'deleted');
  const pageWhere = { ...baseWhere };
  applyCursorCondition(pageWhere, pagination);

  const documents = await LegalDocument.findAll({
    where: pageWhere,
    order: pagination.order,
    limit: pagination.limit + 1,
    paranoid,
  });

  const hasNext = documents.length > pagination.limit;
  const sliced = hasNext ? documents.slice(0, -1) : documents;
  const lastDocument = sliced[sliced.length - 1];
  const nextCursor = lastDocument ? encodeCursor(lastDocument.get(pagination.sortField)) : null;

  const requestedFields = parseListParam(query.fields);
  const perDocumentAnalytics = toBoolean(query.per_document_analytics);
  const data = await Promise.all(
    sliced.map((document) =>
      documentForResponse({ document, analyticsRequested: perDocumentAnalytics }).then((doc) =>
        pickFields(doc, allowedDocumentFields, requestedFields)
      )
    )
  );

  let analyticsPayload;
  if (toBoolean(query.analytics)) {
    const [total, drafts, published, archived] = await Promise.all([
      LegalDocument.count({ where: baseWhere, paranoid }),
      LegalDocument.count({ where: { ...baseWhere, status: 'draft' }, paranoid }),
      LegalDocument.count({ where: { ...baseWhere, status: 'published' }, paranoid }),
      LegalDocument.count({ where: { ...baseWhere, status: 'archived' }, paranoid }),
    ]);
    analyticsPayload = {
      total_documents: total,
      draft_documents: drafts,
      published_documents: published,
      archived_documents: archived,
    };
  }

  return {
    data,
    next_cursor: hasNext ? nextCursor : null,
    analytics: analyticsPayload,
  };
};

const createDocument = async (req, res, user, payload) => {
  ensureAdmin(user);
  const normalized = normalizeDocumentPayload(payload);

  const conflict = await LegalDocument.findOne({
    where: { slug: normalized.slug, version: normalized.version },
    paranoid: false,
  });
  if (conflict) {
    throw new ApiError(409, 'A document with this slug and version already exists', 'LEGAL_DOCUMENT_CONFLICT');
  }

  if (normalized.status === 'published' && !normalized.published_at) {
    normalized.published_at = new Date();
  }
  if (normalized.status && normalized.status !== 'published') {
    normalized.published_at = null;
  }

  const document = await LegalDocument.create(normalized);
  const response = document.toJSON();
  await persistIdempotentResponse(req, res, { status: 201, body: response });
  return response;
};

const updateDocument = async (user, id, payload) => {
  ensureAdmin(user);
  const document = await LegalDocument.findByPk(id, { paranoid: false });
  if (!document) {
    throw new ApiError(404, 'Legal document not found', 'LEGAL_DOCUMENT_NOT_FOUND');
  }

  const normalized = normalizeDocumentPayload(payload);

  const nextSlug = normalized.slug || document.slug;
  const nextVersion = normalized.version || document.version;
  if (nextSlug !== document.slug || nextVersion !== document.version) {
    const conflict = await LegalDocument.findOne({
      where: { slug: nextSlug, version: nextVersion, id: { [Op.not]: id } },
      paranoid: false,
    });
    if (conflict) {
      throw new ApiError(409, 'A document with this slug and version already exists', 'LEGAL_DOCUMENT_CONFLICT');
    }
  }

  if (normalized.status === 'published' && !normalized.published_at) {
    normalized.published_at = new Date();
  }
  if (normalized.status && normalized.status !== 'published') {
    normalized.published_at = null;
  }

  Object.assign(document, normalized);
  await document.save();
  return document.toJSON();
};

const deleteDocument = async (user, id) => {
  ensureAdmin(user);
  const document = await LegalDocument.findByPk(id, { paranoid: false });
  if (!document) {
    throw new ApiError(404, 'Legal document not found', 'LEGAL_DOCUMENT_NOT_FOUND');
  }
  await document.destroy();
  return { success: true };
};

const updateConsent = async (user, id, payload) => {
  if (!user) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  const consent = await LegalConsent.findByPk(id, { paranoid: false });
  if (!consent) {
    throw new ApiError(404, 'Consent record not found', 'CONSENT_NOT_FOUND');
  }
  if (user.role !== 'admin' && consent.user_id !== user.id) {
    throw new ApiError(403, 'You are not permitted to update this consent record', 'FORBIDDEN');
  }

  if (payload.metadata !== undefined) {
    consent.metadata = payload.metadata;
  }

  if (payload.revoked !== undefined) {
    consent.revoked_at = payload.revoked ? new Date() : null;
  }

  if (payload.revoked_at !== undefined) {
    const revokedAt = payload.revoked_at ? dayjs(payload.revoked_at) : null;
    if (payload.revoked_at && (!revokedAt || !revokedAt.isValid())) {
      throw new ApiError(400, 'revoked_at must be a valid datetime', 'INVALID_PAYLOAD');
    }
    consent.revoked_at = revokedAt ? revokedAt.toDate() : null;
  }

  await consent.save();
  return consent.toJSON();
};

const deleteConsent = async (user, id) => {
  if (!user) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  const consent = await LegalConsent.findByPk(id, { paranoid: false });
  if (!consent) {
    throw new ApiError(404, 'Consent record not found', 'CONSENT_NOT_FOUND');
  }
  if (user.role !== 'admin' && consent.user_id !== user.id) {
    throw new ApiError(403, 'You are not permitted to delete this consent record', 'FORBIDDEN');
  }

  await consent.destroy();
  return { success: true };
};

module.exports = {
  getDocument,
  listConsents,
  createConsent,
  getConsent,
  listDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  updateConsent,
  deleteConsent,
};
