const Joi = require('joi');
const legalService = require('../services/legalService');
const { ApiError } = require('../middleware/errorHandler');

const booleanSchema = Joi.boolean().truthy('true').falsy('false');

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', { errors: error.details });
  }
  return value;
};

const documentQuerySchema = Joi.object({
  version: Joi.string().max(64),
  fields: Joi.string(),
  analytics: booleanSchema,
  includeDraft: booleanSchema,
  include_draft: booleanSchema,
}).unknown(true);

const listDocumentsQuerySchema = Joi.object({
  status: Joi.string(),
  slug: Joi.string(),
  version: Joi.string().max(64),
  q: Joi.string().max(255),
  include: Joi.string().valid('deleted'),
  analytics: booleanSchema,
  per_document_analytics: booleanSchema,
  fields: Joi.string(),
  limit: Joi.number().integer().min(1).max(100),
  cursor: Joi.string(),
  sort: Joi.string(),
}).unknown(true);

const baseDocumentSchema = {
  slug: Joi.string().trim().min(2).max(120).pattern(/^[a-z0-9-]+$/i).messages({
    'string.pattern.base': 'slug may only contain letters, numbers, and hyphens',
  }),
  title: Joi.string().trim().min(3).max(255),
  summary: Joi.string().allow('', null),
  content: Joi.string().trim().min(10),
  version: Joi.string().trim().max(64),
  status: Joi.string().valid('draft', 'published', 'archived'),
  effective_at: Joi.date().iso(),
  published_at: Joi.date().iso(),
  metadata: Joi.object().unknown(true).allow(null),
};

const createDocumentSchema = Joi.object({
  ...baseDocumentSchema,
  slug: baseDocumentSchema.slug.required(),
  title: baseDocumentSchema.title.required(),
  content: baseDocumentSchema.content.required(),
  version: baseDocumentSchema.version.required(),
}).required();

const updateDocumentSchema = Joi.object(baseDocumentSchema)
  .min(1)
  .messages({ 'object.min': 'At least one field must be provided to update the document' });

const listConsentsQuerySchema = Joi.object({
  document_slug: Joi.string(),
  document_version: Joi.string(),
  user_id: Joi.string().guid({ version: 'uuidv4' }),
  from: Joi.date().iso(),
  to: Joi.date().iso(),
  cursor: Joi.string(),
  limit: Joi.number().integer().min(1).max(100),
  sort: Joi.string(),
  include: Joi.string().valid('deleted'),
  expand: Joi.string(),
  analytics: booleanSchema,
}).unknown(true);

const createConsentSchema = Joi.object({
  document_slug: Joi.string().required(),
  document_version: Joi.string(),
  consented_at: Joi.date().iso(),
  metadata: Joi.object().unknown(true),
}).required();

const consentQuerySchema = Joi.object({
  expand: Joi.string(),
  include: Joi.string().valid('deleted'),
}).unknown(true);

const updateConsentSchema = Joi.object({
  metadata: Joi.object().unknown(true).allow(null),
  revoked: booleanSchema,
  revoked_at: Joi.date().iso().allow(null),
})
  .min(1)
  .messages({ 'object.min': 'At least one field must be provided to update the consent record' });

const idParamSchema = Joi.string().guid({ version: 'uuidv4' }).required();

const respondWithDocument = (slug) => async (req, res, next) => {
  try {
    const query = validate(documentQuerySchema, req.query);
    const document = await legalService.getDocument(req.user, slug, query);
    res.json(document);
  } catch (error) {
    next(error);
  }
};

const getTerms = respondWithDocument('terms');
const getPrivacy = respondWithDocument('privacy');
const getRefunds = respondWithDocument('refunds');
const getGuidelines = respondWithDocument('guidelines');

const listDocuments = async (req, res, next) => {
  try {
    const query = validate(listDocumentsQuerySchema, req.query);
    const result = await legalService.listDocuments(req.user, query);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const createDocument = async (req, res, next) => {
  try {
    const payload = validate(createDocumentSchema, req.body);
    const document = await legalService.createDocument(req, res, req.user, payload);
    res.status(201).json(document);
  } catch (error) {
    next(error);
  }
};

const updateDocument = async (req, res, next) => {
  try {
    const id = validate(idParamSchema, req.params.id);
    const payload = validate(updateDocumentSchema, req.body);
    const document = await legalService.updateDocument(req.user, id, payload);
    res.json(document);
  } catch (error) {
    next(error);
  }
};

const deleteDocument = async (req, res, next) => {
  try {
    const id = validate(idParamSchema, req.params.id);
    const result = await legalService.deleteDocument(req.user, id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const listConsents = async (req, res, next) => {
  try {
    const query = validate(listConsentsQuerySchema, req.query);
    const result = await legalService.listConsents(req.user, query);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const createConsent = async (req, res, next) => {
  try {
    const payload = validate(createConsentSchema, req.body);
    const consent = await legalService.createConsent(req, res, req.user, payload);
    res.status(201).json(consent);
  } catch (error) {
    next(error);
  }
};

const getConsent = async (req, res, next) => {
  try {
    const query = validate(consentQuerySchema, req.query);
    const id = validate(idParamSchema, req.params.id);
    const consent = await legalService.getConsent(req.user, id, query);
    res.json(consent);
  } catch (error) {
    next(error);
  }
};

const updateConsent = async (req, res, next) => {
  try {
    const id = validate(idParamSchema, req.params.id);
    const payload = validate(updateConsentSchema, req.body);
    const consent = await legalService.updateConsent(req.user, id, payload);
    res.json(consent);
  } catch (error) {
    next(error);
  }
};

const deleteConsent = async (req, res, next) => {
  try {
    const id = validate(idParamSchema, req.params.id);
    const result = await legalService.deleteConsent(req.user, id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTerms,
  getPrivacy,
  getRefunds,
  getGuidelines,
  listDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  listConsents,
  createConsent,
  getConsent,
  updateConsent,
  deleteConsent,
};
