const crypto = require('crypto');
const dayjs = require('dayjs');
const merge = require('lodash/merge');
const speakeasy = require('speakeasy');
const { Op } = require('sequelize');
const {
  User,
  UserSetting,
  Session,
  ApiToken,
  sequelize,
} = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { buildPagination, encodeCursor } = require('../utils/pagination');

const SECTION_DEFAULTS = {
  account: {
    timezone: 'UTC',
    language: 'en',
    marketing_opt_in: false,
    default_currency: 'USD',
    communication_email: null,
  },
  security: {
    two_factor_enabled: false,
    login_alerts: true,
    recovery_codes: [],
    recovery_codes_issued_at: null,
    totp_issuer: 'Gigvora',
  },
  privacy: {
    profile_visibility: 'public',
    search_engine_indexing: true,
    message_privacy: 'connections',
    data_sharing: {
      analytics: true,
      partners: false,
    },
    show_profile_to_companies: true,
  },
  notifications: {
    email: {
      marketing: false,
      product_updates: true,
      security: true,
      reminders: true,
    },
    push: {
      mentions: true,
      messages: true,
      follows: true,
    },
    sms: {
      jobs: false,
      security: true,
    },
    digest_frequency: 'weekly',
  },
  payments: {
    default_method: null,
    payout_schedule: 'monthly',
    tax_form_status: 'pending',
    automatic_withdrawal: false,
    currency: 'USD',
    billing_address: null,
    linked_accounts: [],
  },
  theme: {
    mode: 'system',
    primary_color: '#1f2937',
    accent_color: '#3b82f6',
    font_scale: 1,
    border_radius: 6,
    custom_tokens: {},
  },
};

const splitFieldPaths = (value) =>
  String(value || '')
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);

const sanitizeUser = (user) => {
  if (!user) return null;
  const plain = user.get({ plain: true });
  delete plain.password_hash;
  delete plain.two_factor_secret;
  return plain;
};

const ensureSettings = async (userId, transaction) => {
  const [settings] = await UserSetting.findOrCreate({
    where: { user_id: userId },
    defaults: { user_id: userId },
    transaction,
  });

  let dirty = false;
  Object.entries(SECTION_DEFAULTS).forEach(([section, defaults]) => {
    const current = settings.get(section) || {};
    const merged = merge({}, defaults, current);
    if (JSON.stringify(merged) !== JSON.stringify(current)) {
      settings.set(section, merged);
      dirty = true;
    }
  });

  if (dirty) {
    await settings.save({ transaction });
  }

  return settings;
};

const pickAccountPrefs = (payload) => {
  const keys = ['timezone', 'language', 'marketing_opt_in', 'default_currency', 'communication_email'];
  return keys.reduce((acc, key) => {
    if (payload[key] !== undefined) {
      acc[key] = payload[key];
    }
    return acc;
  }, {});
};

const filterAccountResponse = (response, fields) => {
  if (!fields.length) return response;
  const filtered = {};
  fields.forEach((field) => {
    const [section, subfield] = field.split('.');
    if (!['user', 'account'].includes(section)) {
      return;
    }
    if (!subfield || !response[section] || typeof response[section] !== 'object') {
      filtered[section] = response[section];
      return;
    }
    filtered[section] = filtered[section] || {};
    if (response[section][subfield] !== undefined) {
      filtered[section][subfield] = response[section][subfield];
    }
  });
  return Object.keys(filtered).length ? filtered : response;
};

const getAccount = async (userId, options = {}) => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  }
  const settings = await ensureSettings(userId);
  const account = settings.get('account') || SECTION_DEFAULTS.account;

  const response = {
    user: sanitizeUser(user),
    account,
  };

  const fields = splitFieldPaths(options.fields);
  return filterAccountResponse(response, fields);
};

const updateAccount = async (userId, payload) => {
  const user = await User.scope('withSensitive').findByPk(userId);
  if (!user) {
    throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  }

  const accountPreferences = pickAccountPrefs(payload);

  const updateFields = {};
  if (payload.email !== undefined) updateFields.email = payload.email.toLowerCase();
  if (payload.active_role !== undefined) updateFields.active_role = payload.active_role;
  if (payload.status !== undefined) updateFields.status = payload.status;
  if (payload.metadata !== undefined) {
    user.set('metadata', merge({}, user.metadata || {}, payload.metadata));
  }

  try {
    if (Object.keys(updateFields).length) {
      await user.update(updateFields);
    } else {
      await user.save();
    }
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      throw new ApiError(409, 'Email already in use', 'EMAIL_IN_USE');
    }
    throw error;
  }

  const settings = await ensureSettings(userId);
  if (Object.keys(accountPreferences).length) {
    const merged = merge({}, settings.get('account') || SECTION_DEFAULTS.account, accountPreferences);
    settings.set('account', merged);
    await settings.save();
  }

  const sanitized = await User.findByPk(userId);
  return {
    user: sanitizeUser(sanitized),
    account: settings.get('account'),
  };
};

const generateRecoveryCode = () => {
  const raw = crypto.randomBytes(8).toString('hex');
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
};

const hashRecoveryCode = (code) => crypto.createHash('sha256').update(code).digest('hex');

const listDevices = async (userId, { includeDeleted = false, currentSessionId, analytics = false } = {}) => {
  const sessions = await Session.findAll({
    where: { user_id: userId },
    order: [['created_at', 'DESC']],
    paranoid: !includeDeleted,
  });

  const devices = sessions.map((session) => ({
    id: session.id,
    user_agent: session.user_agent,
    ip_address: session.ip_address,
    created_at: session.created_at,
    updated_at: session.updated_at,
    expires_at: session.expires_at,
    revoked_at: session.revoked_at,
    current: currentSessionId ? session.id === currentSessionId : false,
  }));

  let summary;
  if (analytics) {
    const activeDevices = sessions.filter((session) => !session.revoked_at && (!session.expires_at || session.expires_at > new Date()))
      .length;
    const revokedDevices = sessions.filter((session) => session.revoked_at).length;
    summary = { active_devices: activeDevices, revoked_devices: revokedDevices };
  }

  return { devices, analytics: summary };
};

const getSecurity = async (userId, options = {}) => {
  const settings = await ensureSettings(userId);
  const security = settings.get('security') || SECTION_DEFAULTS.security;
  const includeDeleted = options.includeDeleted === true;
  const { devices, analytics } = await listDevices(userId, {
    includeDeleted,
    currentSessionId: options.currentSessionId,
    analytics: options.analytics === 'true',
  });

  return {
    security: {
      two_factor_enabled: Boolean(security.two_factor_enabled),
      login_alerts: Boolean(security.login_alerts),
      recovery_codes_issued_at: security.recovery_codes_issued_at,
      recovery_codes_count: Array.isArray(security.recovery_codes) ? security.recovery_codes.length : 0,
      totp_issuer: security.totp_issuer || SECTION_DEFAULTS.security.totp_issuer,
    },
    devices,
    analytics,
  };
};

const updateSecurity = async (userContext, payload, options = {}) => {
  const user = await User.scope('withSensitive').findByPk(userContext.id);
  if (!user) {
    throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  }

  const settings = await ensureSettings(user.id);
  const security = settings.get('security') || SECTION_DEFAULTS.security;

  let recoveryCodes;

  if (payload.new_password) {
    const matches = await user.validatePassword(payload.current_password || '');
    if (!matches) {
      throw new ApiError(400, 'Current password is incorrect', 'INVALID_CREDENTIALS');
    }
    user.password_hash = payload.new_password;
  }

  if (payload.login_alerts !== undefined) {
    security.login_alerts = payload.login_alerts;
  }

  if (payload.two_factor_enabled !== undefined) {
    security.two_factor_enabled = payload.two_factor_enabled;
    if (payload.two_factor_enabled) {
      if (!user.two_factor_secret) {
        const secret = speakeasy.generateSecret({ length: 32, name: 'Gigvora', issuer: 'Gigvora' });
        user.two_factor_secret = secret.base32;
        security.totp_issuer = secret.issuer;
        security.totp_label = secret.accountName;
      }
    } else {
      user.two_factor_secret = null;
    }
  }

  if (payload.regenerate_recovery_codes) {
    recoveryCodes = Array.from({ length: 10 }, generateRecoveryCode);
    security.recovery_codes = recoveryCodes.map(hashRecoveryCode);
    security.recovery_codes_issued_at = new Date();
  }

  await sequelize.transaction(async (transaction) => {
    await user.save({ transaction });
    settings.set('security', merge({}, SECTION_DEFAULTS.security, security));
    await settings.save({ transaction });

    if (payload.sessions_to_revoke?.length) {
      await Session.update(
        { revoked_at: new Date() },
        { where: { user_id: user.id, id: { [Op.in]: payload.sessions_to_revoke } }, transaction }
      );
      await Session.destroy({
        where: { user_id: user.id, id: { [Op.in]: payload.sessions_to_revoke } },
        transaction,
      });
    }
  });

  const result = await getSecurity(user.id, {
    includeDeleted: options.includeDeleted,
    currentSessionId: options.currentSessionId,
    analytics: options.analytics,
  });

  if (recoveryCodes) {
    result.recovery_codes = recoveryCodes;
  }

  return result;
};

const getPrivacy = async (userId) => {
  const settings = await ensureSettings(userId);
  return settings.get('privacy') || SECTION_DEFAULTS.privacy;
};

const updatePrivacy = async (userId, payload) => {
  const settings = await ensureSettings(userId);
  const merged = merge({}, settings.get('privacy') || SECTION_DEFAULTS.privacy, payload);
  settings.set('privacy', merged);
  await settings.save();
  return merged;
};

const getNotifications = async (userId) => {
  const settings = await ensureSettings(userId);
  return settings.get('notifications') || SECTION_DEFAULTS.notifications;
};

const updateNotifications = async (userId, payload) => {
  const settings = await ensureSettings(userId);
  const merged = merge({}, settings.get('notifications') || SECTION_DEFAULTS.notifications, payload);
  settings.set('notifications', merged);
  await settings.save();
  return merged;
};

const getPayments = async (userId) => {
  const settings = await ensureSettings(userId);
  return settings.get('payments') || SECTION_DEFAULTS.payments;
};

const updatePayments = async (userId, payload) => {
  const settings = await ensureSettings(userId);
  const merged = merge({}, settings.get('payments') || SECTION_DEFAULTS.payments, payload);
  settings.set('payments', merged);
  await settings.save();
  return merged;
};

const getTheme = async (userId) => {
  const settings = await ensureSettings(userId);
  return settings.get('theme') || SECTION_DEFAULTS.theme;
};

const updateTheme = async (userId, payload) => {
  const settings = await ensureSettings(userId);
  const merged = merge({}, settings.get('theme') || SECTION_DEFAULTS.theme, payload);
  settings.set('theme', merged);
  await settings.save();
  return merged;
};

const serializeToken = (token) => {
  const plain = token.get({ plain: true });
  delete plain.token_hash;
  return {
    ...plain,
    scopes: plain.scopes || [],
  };
};

const listApiTokens = async (userContext, query = {}) => {
  const targetUserId = userContext.role === 'admin' && query.user_id ? query.user_id : userContext.id;
  const pagination = buildPagination(query, ['created_at', 'updated_at', 'last_used_at']);
  const includeFlags = new Set(String(query.include || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean));

  const where = { user_id: targetUserId };
  if (query.q) {
    where.name = { [Op.like]: `%${query.q}%` };
  }

  if (pagination.cursorValue !== undefined) {
    where[pagination.sortField] = {
      ...(where[pagination.sortField] || {}),
      [pagination.cursorOperator]: pagination.cursorValue,
    };
  }

  const paranoid = !(userContext.role === 'admin' && includeFlags.has('deleted'));

  const { rows, count } = await ApiToken.findAndCountAll({
    where,
    order: pagination.order,
    limit: pagination.limit + 1,
    paranoid,
  });

  const hasMore = rows.length > pagination.limit;
  const items = hasMore ? rows.slice(0, pagination.limit) : rows;
  const data = items.map(serializeToken);
  const nextCursor = hasMore
    ? encodeCursor(items[items.length - 1].get(pagination.sortField))
    : null;

  let analytics;
  if (query.analytics === 'true') {
    const [active, revoked] = await Promise.all([
      ApiToken.count({ where: { user_id: targetUserId, revoked_at: null } }),
      ApiToken.count({ where: { user_id: targetUserId, revoked_at: { [Op.ne]: null } }, paranoid: false }),
    ]);
    analytics = { active_tokens: active, revoked_tokens: revoked };
  }

  return {
    data,
    total: typeof count === 'number' ? count : Array.isArray(count) ? count.length : 0,
    page: {
      next_cursor: nextCursor,
      limit: pagination.limit,
    },
    analytics,
  };
};

const randomToken = () =>
  `gv_${crypto
    .randomBytes(32)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')}`;

const createApiToken = async (userContext, payload, { ip, userAgent } = {}) => {
  const tokenValue = randomToken();
  const tokenHash = crypto.createHash('sha256').update(tokenValue).digest('hex');
  const tokenPrefix = tokenValue.slice(0, 8);

  const expiresAt = payload.expires_at ? dayjs(payload.expires_at).toDate() : null;
  if (expiresAt && expiresAt < new Date()) {
    throw new ApiError(400, 'Expiration must be in the future', 'INVALID_EXPIRATION');
  }

  const existingCount = await ApiToken.count({
    where: { user_id: userContext.id, deleted_at: null },
    paranoid: false,
  });
  if (existingCount >= 50) {
    throw new ApiError(422, 'Maximum token limit reached', 'TOKEN_LIMIT_REACHED');
  }

  const created = await ApiToken.create({
    user_id: userContext.id,
    name: payload.name,
    token_hash: tokenHash,
    token_prefix: tokenPrefix,
    scopes: payload.scopes || [],
    expires_at: expiresAt,
    created_by_ip: ip || null,
    metadata: {
      ...(payload.metadata || {}),
      user_agent: userAgent || null,
    },
  });

  const serialized = serializeToken(created);
  return {
    token: tokenValue,
    ...serialized,
  };
};

const revokeApiToken = async (userContext, tokenId) => {
  const token = await ApiToken.findByPk(tokenId, { paranoid: false });
  if (!token) {
    throw new ApiError(404, 'Token not found', 'TOKEN_NOT_FOUND');
  }

  if (token.user_id !== userContext.id && userContext.role !== 'admin') {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }

  if (!token.revoked_at) {
    token.revoked_at = new Date();
    await token.save();
  }

  if (!token.deleted_at) {
    await token.destroy();
  }

  return { success: true, revoked_at: token.revoked_at };
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
  createApiToken,
  revokeApiToken,
};
