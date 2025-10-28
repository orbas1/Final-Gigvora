const Joi = require('joi');
const service = require('../services/conversationService');
const { ApiError } = require('../middleware/errorHandler');
const { persistIdempotentResponse } = require('../middleware/idempotency');

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', { errors: error.details });
  }
  return value;
};

const attachmentsSchema = Joi.array().items(
  Joi.object({
    id: Joi.string().optional(),
    url: Joi.string().uri().required(),
    type: Joi.string().valid('image', 'video', 'file', 'audio', 'other').default('other'),
    name: Joi.string().optional(),
    size: Joi.number().integer().min(0).optional(),
    metadata: Joi.object().optional(),
  })
);

const listConversationsSchema = Joi.object({
  cursor: Joi.string().optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  sort: Joi.string().optional(),
  participant_id: Joi.string().uuid().optional(),
  analytics: Joi.boolean().optional(),
  include: Joi.string().valid('deleted').optional(),
  scope: Joi.string().valid('own', 'all').optional(),
  q: Joi.string().trim().optional(),
  fields: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).optional(),
  expand: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).optional(),
});

const createConversationSchema = Joi.object({
  title: Joi.string().allow('', null),
  participants: Joi.array().items(Joi.string().uuid()).min(1).required(),
  metadata: Joi.object().optional(),
});

const getConversationSchema = Joi.object({
  include: Joi.string().valid('deleted').optional(),
  expand: Joi.alternatives()
    .try(Joi.array().items(Joi.string()), Joi.string())
    .optional(),
});

const updateConversationSchema = Joi.object({
  title: Joi.string().allow('', null).optional(),
  pinned: Joi.boolean().optional(),
  archived: Joi.boolean().optional(),
}).min(1);

const listMessagesSchema = Joi.object({
  cursor: Joi.string().optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  analytics: Joi.boolean().optional(),
  q: Joi.string().trim().optional(),
  fields: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).optional(),
  expand: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).optional(),
});

const createMessageSchema = Joi.object({
  text: Joi.string().allow('', null),
  attachments: attachmentsSchema.default([]),
  metadata: Joi.object().optional(),
}).custom((value, helpers) => {
  const hasText = value.text && String(value.text).trim().length > 0;
  const hasAttachments = Array.isArray(value.attachments) && value.attachments.length > 0;
  if (!hasText && !hasAttachments) {
    return helpers.error('any.custom', { message: 'text or attachments must be provided' });
  }
  return value;
});

const updateMessageSchema = Joi.object({
  text: Joi.string().allow('', null),
  attachments: attachmentsSchema.default([]),
  metadata: Joi.object().optional(),
})
  .custom((value, helpers) => {
    const hasText = value.text && String(value.text).trim().length > 0;
    const hasAttachments = Array.isArray(value.attachments) && value.attachments.length > 0;
    if (!hasText && !hasAttachments) {
      return helpers.error('any.custom', { message: 'text or attachments must be provided' });
    }
    return value;
  })
  .min(1);

const messageReadSchema = Joi.object({});

const messageAnalyticsSchema = Joi.object({
  from: Joi.date().optional(),
  to: Joi.date().optional(),
  by: Joi.string().valid('day', 'week', 'month').default('day'),
  scope: Joi.string().valid('user', 'org', 'platform').default('user'),
  user_id: Joi.string().uuid().optional(),
  org_id: Joi.string().uuid().optional(),
});

const parseExpand = (expand) => {
  if (!expand) return [];
  if (Array.isArray(expand)) return expand;
  return String(expand)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const listConversations = async (req, res, next) => {
  try {
    const payload = validate(listConversationsSchema, req.query);
    const result = await service.listConversations(req.user, {
      ...payload,
      fields: toArray(payload.fields),
      expand: toArray(payload.expand),
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const createConversation = async (req, res, next) => {
  try {
    const payload = validate(createConversationSchema, req.body);
    const conversation = await service.createConversation(req.user, payload);
    res.status(201).json({ conversation });
  } catch (error) {
    next(error);
  }
};

const getConversation = async (req, res, next) => {
  try {
    const payload = validate(getConversationSchema, req.query);
    const expand = parseExpand(payload.expand);
    const conversation = await service.getConversation(req.user, req.params.conversationId, {
      includeDeleted: payload.include === 'deleted',
      expand,
    });
    res.json({ conversation });
  } catch (error) {
    next(error);
  }
};

const updateConversation = async (req, res, next) => {
  try {
    const payload = validate(updateConversationSchema, req.body);
    const conversation = await service.updateConversation(req.user, req.params.conversationId, payload);
    res.json({ conversation });
  } catch (error) {
    next(error);
  }
};

const deleteConversation = async (req, res, next) => {
  try {
    const result = await service.deleteConversation(req.user, req.params.conversationId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const listMessages = async (req, res, next) => {
  try {
    const payload = validate(listMessagesSchema, req.query);
    const result = await service.listMessages(req.user, req.params.conversationId, {
      ...payload,
      fields: toArray(payload.fields),
      expand: toArray(payload.expand),
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const createMessage = async (req, res, next) => {
  try {
    const payload = validate(createMessageSchema, req.body);
    const message = await service.createMessage(req.user, req.params.conversationId, payload);
    const responsePayload = { message };
    await persistIdempotentResponse(req, res, { status: 201, body: responsePayload });
    res.status(201).json(responsePayload);
  } catch (error) {
    next(error);
  }
};

const updateMessage = async (req, res, next) => {
  try {
    const payload = validate(updateMessageSchema, req.body);
    const message = await service.updateMessage(req.user, req.params.messageId, payload);
    res.json({ message });
  } catch (error) {
    next(error);
  }
};

const deleteMessage = async (req, res, next) => {
  try {
    const result = await service.deleteMessage(req.user, req.params.messageId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const markMessageRead = async (req, res, next) => {
  try {
    validate(messageReadSchema, req.body || {});
    const result = await service.markMessageRead(req.user, req.params.messageId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const messageVolumeAnalytics = async (req, res, next) => {
  try {
    const payload = validate(messageAnalyticsSchema, req.query);
    const result = await service.messageVolumeAnalytics(req.user, payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listConversations,
  createConversation,
  getConversation,
  updateConversation,
  deleteConversation,
  listMessages,
  createMessage,
  updateMessage,
  deleteMessage,
  markMessageRead,
  messageVolumeAnalytics,
};
