const Joi = require('joi');
const settingsService = require('../services/settingsService');
const { ApiError } = require('../middleware/errorHandler');
const { persistIdempotentResponse } = require('../middleware/idempotency');

const colorPattern = /^#(?:[0-9a-fA-F]{3}){1,2}$/;

const validate = (schema, payload) => {
  const { value, error } = schema.validate(payload, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) {
    throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', {
      errors: error.details.map((detail) => ({ message: detail.message, path: detail.path })),
    });
  }
  return value;
};

const accountSchema = Joi.object({
  email: Joi.string().email(),
  active_role: Joi.string(),
  status: Joi.string(),
  metadata: Joi.object(),
  timezone: Joi.string(),
  language: Joi.string(),
  marketing_opt_in: Joi.boolean(),
  default_currency: Joi.string().length(3).uppercase(),
  communication_email: Joi.string().email().allow(null),
}).min(1);

const securitySchema = Joi.object({
  two_factor_enabled: Joi.boolean(),
  login_alerts: Joi.boolean(),
  current_password: Joi.string().min(8),
  new_password: Joi.string().min(8),
  regenerate_recovery_codes: Joi.boolean(),
  sessions_to_revoke: Joi.array().items(Joi.string().guid({ version: 'uuidv4' })).single(),
}).with('new_password', 'current_password');

const privacySchema = Joi.object({
  profile_visibility: Joi.string().valid('public', 'private', 'connections'),
  search_engine_indexing: Joi.boolean(),
  message_privacy: Joi.string().valid('everyone', 'connections', 'none'),
  data_sharing: Joi.object({
    analytics: Joi.boolean(),
    partners: Joi.boolean(),
  }),
  show_profile_to_companies: Joi.boolean(),
}).min(1);

const notificationsSchema = Joi.object({
  email: Joi.object({
    marketing: Joi.boolean(),
    product_updates: Joi.boolean(),
    security: Joi.boolean(),
    reminders: Joi.boolean(),
  }),
  push: Joi.object({
    mentions: Joi.boolean(),
    messages: Joi.boolean(),
    follows: Joi.boolean(),
  }),
  sms: Joi.object({
    jobs: Joi.boolean(),
    security: Joi.boolean(),
  }),
  digest_frequency: Joi.string().valid('daily', 'weekly', 'monthly', 'never'),
}).min(1);

const paymentsSchema = Joi.object({
  default_method: Joi.string().allow(null),
  payout_schedule: Joi.string().valid('weekly', 'biweekly', 'monthly', 'manual'),
  tax_form_status: Joi.string().valid('pending', 'submitted', 'verified', 'rejected'),
  automatic_withdrawal: Joi.boolean(),
  currency: Joi.string().length(3).uppercase(),
  billing_address: Joi.object({
    line1: Joi.string().allow('', null),
    line2: Joi.string().allow('', null),
    city: Joi.string().allow('', null),
    state: Joi.string().allow('', null),
    postal_code: Joi.string().allow('', null),
    country: Joi.string().length(2).uppercase(),
  }).allow(null),
  linked_accounts: Joi.array().items(
    Joi.object({
      provider: Joi.string().required(),
      account_id: Joi.string().required(),
      display_name: Joi.string().allow(null, ''),
      last4: Joi.string().pattern(/^[0-9]{4}$/).allow(null),
      verified: Joi.boolean(),
    })
  ),
}).min(1);

const themeSchema = Joi.object({
  mode: Joi.string().valid('light', 'dark', 'system'),
  primary_color: Joi.string().pattern(colorPattern),
  accent_color: Joi.string().pattern(colorPattern),
  font_scale: Joi.number().min(0.8).max(1.5),
  border_radius: Joi.number().min(0).max(16),
  custom_tokens: Joi.object(),
}).min(1);

const createTokenSchema = Joi.object({
  name: Joi.string().min(3).max(120).required(),
  scopes: Joi.array().items(Joi.string().pattern(/^[a-z0-9:_-]+$/i)).default([]),
  expires_at: Joi.date().greater('now').optional(),
  metadata: Joi.object().optional(),
});

const listTokensSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).optional(),
  cursor: Joi.string().optional(),
  sort: Joi.string().optional(),
  q: Joi.string().optional(),
  include: Joi.string().optional(),
  fields: Joi.string().optional(),
  expand: Joi.string().optional(),
  analytics: Joi.boolean().truthy('true').falsy('false').optional(),
  user_id: Joi.string().guid({ version: 'uuidv4' }).optional(),
});

const tokenQuerySchema = Joi.object({
  analytics: Joi.boolean().truthy('true').falsy('false').optional(),
  include: Joi.string().optional(),
});

const updateTokenSchema = Joi.object({
  name: Joi.string().min(3).max(120),
  scopes: Joi.array().items(Joi.string().pattern(/^[a-z0-9:_-]+$/i)),
  expires_at: Joi.date().greater('now').allow(null),
  metadata: Joi.object(),
  revoke: Joi.boolean(),
  restore: Joi.boolean(),
})
  .or('name', 'scopes', 'expires_at', 'metadata', 'revoke', 'restore')
  .messages({ 'object.missing': 'At least one property must be provided' });

const includeDeleted = (query, user) => {
  if (!user || user.role !== 'admin') return false;
  const values = String(query.include || '')
    .split(',')
    .map((v) => v.trim().toLowerCase());
  return values.includes('deleted');
};

const parseAnalyticsFlag = (value) => value === true || value === 'true';

const getAccount = async (req, res, next) => {
  try {
    const account = await settingsService.getAccount(req.user.id, {
      fields: req.query.fields,
      analytics: parseAnalyticsFlag(req.query.analytics),
    });
    res.json(account);
  } catch (error) {
    next(error);
  }
};

const updateAccount = async (req, res, next) => {
  try {
    const payload = validate(accountSchema, req.body);
    const account = await settingsService.updateAccount(req.user.id, payload, {
      analytics: parseAnalyticsFlag(req.query.analytics),
    });
    res.json(account);
  } catch (error) {
    next(error);
  }
};

const resetAccount = async (req, res, next) => {
  try {
    const account = await settingsService.resetAccount(req.user.id, {
      analytics: parseAnalyticsFlag(req.query.analytics),
    });
    res.json(account);
  } catch (error) {
    next(error);
  }
};

const getSecurity = async (req, res, next) => {
  try {
    const data = await settingsService.getSecurity(req.user.id, {
      includeDeleted: includeDeleted(req.query, req.user),
      currentSessionId: req.session?.id,
      analytics: parseAnalyticsFlag(req.query.analytics),
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
};

const updateSecurity = async (req, res, next) => {
  try {
    const payload = validate(securitySchema, req.body);
    const data = await settingsService.updateSecurity(
      req.user,
      payload,
      {
        includeDeleted: includeDeleted(req.query, req.user),
        currentSessionId: req.session?.id,
        analytics: parseAnalyticsFlag(req.query.analytics),
      }
    );
    res.json(data);
  } catch (error) {
    next(error);
  }
};

const resetSecurity = async (req, res, next) => {
  try {
    const data = await settingsService.resetSecurity(req.user.id, {
      includeDeleted: includeDeleted(req.query, req.user),
      currentSessionId: req.session?.id,
      analytics: parseAnalyticsFlag(req.query.analytics),
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
};

const getPrivacy = async (req, res, next) => {
  try {
    const privacy = await settingsService.getPrivacy(req.user.id, {
      analytics: parseAnalyticsFlag(req.query.analytics),
    });
    res.json(privacy);
  } catch (error) {
    next(error);
  }
};

const updatePrivacy = async (req, res, next) => {
  try {
    const payload = validate(privacySchema, req.body);
    const privacy = await settingsService.updatePrivacy(req.user.id, payload, {
      analytics: parseAnalyticsFlag(req.query.analytics),
    });
    res.json(privacy);
  } catch (error) {
    next(error);
  }
};

const resetPrivacy = async (req, res, next) => {
  try {
    const privacy = await settingsService.resetPrivacy(req.user.id, {
      analytics: parseAnalyticsFlag(req.query.analytics),
    });
    res.json(privacy);
  } catch (error) {
    next(error);
  }
};

const getNotifications = async (req, res, next) => {
  try {
    const notifications = await settingsService.getNotifications(req.user.id, {
      analytics: parseAnalyticsFlag(req.query.analytics),
    });
    res.json(notifications);
  } catch (error) {
    next(error);
  }
};

const updateNotifications = async (req, res, next) => {
  try {
    const payload = validate(notificationsSchema, req.body);
    const notifications = await settingsService.updateNotifications(req.user.id, payload, {
      analytics: parseAnalyticsFlag(req.query.analytics),
    });
    res.json(notifications);
  } catch (error) {
    next(error);
  }
};

const resetNotifications = async (req, res, next) => {
  try {
    const notifications = await settingsService.resetNotifications(req.user.id, {
      analytics: parseAnalyticsFlag(req.query.analytics),
    });
    res.json(notifications);
  } catch (error) {
    next(error);
  }
};

const getPayments = async (req, res, next) => {
  try {
    const payments = await settingsService.getPayments(req.user.id, {
      analytics: parseAnalyticsFlag(req.query.analytics),
    });
    res.json(payments);
  } catch (error) {
    next(error);
  }
};

const updatePayments = async (req, res, next) => {
  try {
    const payload = validate(paymentsSchema, req.body);
    const payments = await settingsService.updatePayments(req.user.id, payload, {
      analytics: parseAnalyticsFlag(req.query.analytics),
    });
    res.json(payments);
  } catch (error) {
    next(error);
  }
};

const resetPayments = async (req, res, next) => {
  try {
    const payments = await settingsService.resetPayments(req.user.id, {
      analytics: parseAnalyticsFlag(req.query.analytics),
    });
    res.json(payments);
  } catch (error) {
    next(error);
  }
};

const getTheme = async (req, res, next) => {
  try {
    const theme = await settingsService.getTheme(req.user.id, {
      analytics: parseAnalyticsFlag(req.query.analytics),
    });
    res.json(theme);
  } catch (error) {
    next(error);
  }
};

const updateTheme = async (req, res, next) => {
  try {
    const payload = validate(themeSchema, req.body);
    const theme = await settingsService.updateTheme(req.user.id, payload, {
      analytics: parseAnalyticsFlag(req.query.analytics),
    });
    res.json(theme);
  } catch (error) {
    next(error);
  }
};

const resetTheme = async (req, res, next) => {
  try {
    const theme = await settingsService.resetTheme(req.user.id, {
      analytics: parseAnalyticsFlag(req.query.analytics),
    });
    res.json(theme);
  } catch (error) {
    next(error);
  }
};

const listApiTokens = async (req, res, next) => {
  try {
    const query = validate(listTokensSchema, req.query);
    const tokens = await settingsService.listApiTokens(req.user, query);
    res.json(tokens);
  } catch (error) {
    next(error);
  }
};

const createApiToken = async (req, res, next) => {
  try {
    const payload = validate(createTokenSchema, req.body);
    const token = await settingsService.createApiToken(req.user, payload, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      analytics: parseAnalyticsFlag(req.query.analytics),
    });
    await persistIdempotentResponse(req, res, { status: 201, body: token });
    res.status(201).json(token);
  } catch (error) {
    next(error);
  }
};

const getApiToken = async (req, res, next) => {
  try {
    const query = validate(tokenQuerySchema, req.query);
    const token = await settingsService.getApiToken(req.user, req.params.id, {
      includeDeleted: includeDeleted(req.query, req.user),
      analytics: Boolean(query.analytics),
    });
    res.json(token);
  } catch (error) {
    next(error);
  }
};

const updateApiToken = async (req, res, next) => {
  try {
    const query = validate(tokenQuerySchema, req.query);
    const payload = validate(updateTokenSchema, req.body);
    const token = await settingsService.updateApiToken(req.user, req.params.id, payload, {
      includeDeleted: includeDeleted(req.query, req.user),
      analytics: Boolean(query.analytics),
    });
    res.json(token);
  } catch (error) {
    next(error);
  }
};

const deleteApiToken = async (req, res, next) => {
  try {
    const query = validate(tokenQuerySchema, req.query);
    const result = await settingsService.revokeApiToken(req.user, req.params.id, {
      analytics: Boolean(query.analytics),
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAccount,
  updateAccount,
  resetAccount,
  getSecurity,
  updateSecurity,
  resetSecurity,
  getPrivacy,
  updatePrivacy,
  resetPrivacy,
  getNotifications,
  updateNotifications,
  resetNotifications,
  getPayments,
  updatePayments,
  resetPayments,
  getTheme,
  updateTheme,
  resetTheme,
  listApiTokens,
  createApiToken,
  getApiToken,
  updateApiToken,
  deleteApiToken,
};
