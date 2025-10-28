const Joi = require('joi');
const settingsService = require('../services/settingsService');
const { persistIdempotentResponse } = require('../middleware/idempotency');

const validate = async (schema, payload, options = {}) =>
  schema.validateAsync(payload, { abortEarly: false, stripUnknown: true, ...options });

const booleanSchema = Joi.boolean().truthy('true').truthy('1').falsy('false').falsy('0');

const accountUpdateSchema = Joi.object({
  email: Joi.string().email(),
  display_name: Joi.string().max(120).allow(null, ''),
  headline: Joi.string().max(160).allow(null, ''),
  location: Joi.string().max(160).allow(null, ''),
  language: Joi.string().max(10),
  timezone: Joi.string().max(60),
  week_start: Joi.string().valid('monday', 'sunday', 'saturday'),
  currency: Joi.string().length(3).uppercase(),
  communication_email: Joi.string().email().allow(null, ''),
}).min(1);

const securityQuerySchema = Joi.object({ analytics: booleanSchema.default(false) });

const securityUpdateSchema = Joi.object({
  two_factor_enabled: Joi.boolean(),
  login_notifications: Joi.object({ email: Joi.boolean(), push: Joi.boolean() }).unknown(true),
  allowed_ips: Joi.array().items(Joi.string().ip({ version: ['ipv4', 'ipv6'], cidr: 'forbidden' })).max(50),
  device_verification: Joi.boolean(),
  password: Joi.object({
    current_password: Joi.string().required(),
    new_password: Joi.string().min(8).required(),
  }),
  revoke_session_ids: Joi.array().items(Joi.string().uuid()),
  global_logout: Joi.boolean(),
}).min(1);

const privacyUpdateSchema = Joi.object({
  profile_visibility: Joi.string().valid('public', 'private', 'connections'),
  search_engine_indexing: Joi.boolean(),
  message_privacy: Joi.string().valid('anyone', 'connections', 'no_one'),
  activity_status: Joi.string().valid('online', 'away', 'hidden'),
  data_sharing: Joi.object({ analytics: Joi.boolean(), partners: Joi.boolean(), research: Joi.boolean() }).unknown(true),
}).min(1);

const notificationsUpdateSchema = Joi.object({
  channels: Joi.object().pattern(/.*/, Joi.object().unknown(true)).unknown(true),
  digest: Joi.object({ frequency: Joi.string().valid('immediate', 'hourly', 'daily', 'weekly') }).unknown(true),
  quiet_hours: Joi.object({
    enabled: Joi.boolean(),
    from: Joi.string().pattern(/^\d{2}:\d{2}$/),
    to: Joi.string().pattern(/^\d{2}:\d{2}$/),
  }).unknown(true),
  product_updates: Joi.object({ email: Joi.boolean(), in_app: Joi.boolean() }).unknown(true),
}).min(1);

const paymentsQuerySchema = Joi.object({ analytics: booleanSchema.default(false) });

const paymentsUpdateSchema = Joi.object({
  default_payment_method_id: Joi.string().uuid(),
  default_payout_account_id: Joi.string().uuid(),
  payout_schedule: Joi.string().valid('weekly', 'biweekly', 'monthly', 'on_demand'),
  auto_withdraw: Joi.boolean(),
  invoicing: Joi.object({ auto_generate: Joi.boolean(), net_terms: Joi.string().max(20) }).unknown(true),
  tax_profile: Joi.object({ country: Joi.string().length(2).uppercase(), vat_number: Joi.string().max(32) }).unknown(true),
}).min(1);

const themeUpdateSchema = Joi.object({
  theme: Joi.object({
    mode: Joi.string().valid('light', 'dark', 'system'),
    accent_color: Joi.string().pattern(/^#?[0-9a-fA-F]{6}$/),
    density: Joi.string().valid('comfortable', 'compact'),
  }).unknown(true),
  tokens: Joi.object().pattern(/^--/, Joi.string().max(120)),
}).min(1);

const apiTokenListSchema = Joi.object({
  cursor: Joi.string(),
  limit: Joi.number().integer().min(1).max(100),
  sort: Joi.string(),
  q: Joi.string().allow(''),
  include: Joi.string(),
  analytics: booleanSchema,
});

const apiTokenCreateSchema = Joi.object({
  name: Joi.string().max(120).required(),
  description: Joi.string().max(500).allow('', null),
  scopes: Joi.array().items(Joi.string().max(60)).default([]),
  expires_at: Joi.date(),
  ip_allowlist: Joi.array().items(Joi.string().ip({ version: ['ipv4', 'ipv6'], cidr: 'forbidden' })).max(50),
  metadata: Joi.object().unknown(true),
});

const apiTokenUpdateSchema = Joi.object({
  name: Joi.string().max(120),
  description: Joi.string().allow('', null),
  scopes: Joi.array().items(Joi.string().max(60)),
  status: Joi.string().valid('active', 'revoked', 'expired'),
  expires_at: Joi.date().allow(null),
  ip_allowlist: Joi.array().items(Joi.string().ip({ version: ['ipv4', 'ipv6'], cidr: 'forbidden' })).max(50),
  metadata: Joi.object().unknown(true),
}).min(1);

const getAccount = async (req, res, next) => {
  try {
    const result = await settingsService.getAccount(req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const updateAccount = async (req, res, next) => {
  try {
    const payload = await validate(accountUpdateSchema, req.body || {});
    const result = await settingsService.updateAccount(req.user.id, payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getSecurity = async (req, res, next) => {
  try {
    const query = await validate(securityQuerySchema, req.query || {});
    const result = await settingsService.getSecurity(req.user.id, query);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const updateSecurity = async (req, res, next) => {
  try {
    const payload = await validate(securityUpdateSchema, req.body || {});
    const result = await settingsService.updateSecurity(req.user, payload, { currentSessionId: req.session?.id });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getPrivacy = async (req, res, next) => {
  try {
    const result = await settingsService.getPrivacy(req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const updatePrivacy = async (req, res, next) => {
  try {
    const payload = await validate(privacyUpdateSchema, req.body || {});
    const result = await settingsService.updatePrivacy(req.user.id, payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getNotifications = async (req, res, next) => {
  try {
    const result = await settingsService.getNotifications(req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const updateNotifications = async (req, res, next) => {
  try {
    const payload = await validate(notificationsUpdateSchema, req.body || {});
    const result = await settingsService.updateNotifications(req.user.id, payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getPayments = async (req, res, next) => {
  try {
    const query = await validate(paymentsQuerySchema, req.query || {});
    const result = await settingsService.getPayments(req.user.id, query);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const updatePayments = async (req, res, next) => {
  try {
    const payload = await validate(paymentsUpdateSchema, req.body || {});
    const result = await settingsService.updatePayments(req.user.id, payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getTheme = async (req, res, next) => {
  try {
    const result = await settingsService.getTheme(req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const updateTheme = async (req, res, next) => {
  try {
    const payload = await validate(themeUpdateSchema, req.body || {});
    const result = await settingsService.updateTheme(req.user.id, payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const listApiTokens = async (req, res, next) => {
  try {
    const query = await validate(apiTokenListSchema, req.query || {});
    const result = await settingsService.listApiTokens(req.user, query);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getApiToken = async (req, res, next) => {
  try {
    const token = await settingsService.getApiToken(req.user, req.params.id, {
      includeDeleted: req.query.include === 'deleted' && req.user.role === 'admin',
    });
    res.json(token);
  } catch (error) {
    next(error);
  }
};

const createApiToken = async (req, res, next) => {
  try {
    const payload = await validate(apiTokenCreateSchema, req.body || {});
    const result = await settingsService.createApiToken(req.user, payload);
    persistIdempotentResponse(req, res, { status: 201, body: result });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const updateApiToken = async (req, res, next) => {
  try {
    const payload = await validate(apiTokenUpdateSchema, req.body || {});
    const result = await settingsService.updateApiToken(req.user, req.params.id, payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const deleteApiToken = async (req, res, next) => {
  try {
    const result = await settingsService.deleteApiToken(req.user, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAccount,
  updateAccount,
  getSecurity,
  updateSecurity,
  getPrivacy,
  updatePrivacy,
  getNotifications,
  updateNotifications,
  getPayments,
  updatePayments,
  getTheme,
  updateTheme,
  listApiTokens,
  getApiToken,
  createApiToken,
  updateApiToken,
  deleteApiToken,
};
