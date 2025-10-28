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
  Connection,
  UserFollow,
  Post,
  Notification,
  UserBlock,
  UserReport,
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

const cloneSectionDefaults = (section) => merge({}, SECTION_DEFAULTS[section] || {});

const buildAccountAnalytics = async (userId) => {
  const [connections, followers, following, posts, activeTokens, activeSessions] = await Promise.all([
    Connection.count({
      where: {
        status: 'accepted',
        [Op.or]: [{ requester_id: userId }, { addressee_id: userId }],
      },
    }),
    UserFollow.count({ where: { followee_id: userId } }),
    UserFollow.count({ where: { follower_id: userId } }),
    Post.count({ where: { user_id: userId } }),
    ApiToken.count({ where: { user_id: userId, revoked_at: null } }),
    Session.count({ where: { user_id: userId, revoked_at: null } }),
  ]);

  return {
    connections_total: connections,
    followers_total: followers,
    following_total: following,
    posts_published: posts,
    api_tokens_active: activeTokens,
    active_sessions: activeSessions,
  };
};

const buildPrivacyAnalytics = async (userId) => {
  const [blocked, blockedBy, reportsMade, reportsReceived] = await Promise.all([
    UserBlock.count({ where: { blocker_id: userId } }),
    UserBlock.count({ where: { blocked_id: userId } }),
    UserReport.count({ where: { reporter_id: userId } }),
    UserReport.count({ where: { reported_id: userId } }),
  ]);

  return {
    blocked_users: blocked,
    blocked_by_users: blockedBy,
    reports_made: reportsMade,
    reports_received: reportsReceived,
  };
};

const buildNotificationAnalytics = async (userId) => {
  const where = { user_id: userId };
  const [total, unread, byChannel, lastNotification] = await Promise.all([
    Notification.count({ where }),
    Notification.count({ where: { ...where, read_at: null } }),
    Notification.findAll({
      where,
      attributes: ['channel', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['channel'],
    }),
    Notification.findOne({ where, order: [['created_at', 'DESC']], attributes: ['created_at'] }),
  ]);

  const channelBreakdown = byChannel.reduce((acc, row) => {
    const plain = row.get({ plain: true });
    acc[plain.channel || 'unknown'] = Number(plain.count) || 0;
    return acc;
  }, {});

  return {
    total_notifications: total,
    unread_notifications: unread,
    last_notification_at: lastNotification?.created_at || null,
    channel_breakdown: channelBreakdown,
  };
};

const buildPaymentsAnalytics = (payments) => {
  const normalized = merge({}, SECTION_DEFAULTS.payments, payments || {});
  const linkedAccounts = Array.isArray(normalized.linked_accounts) ? normalized.linked_accounts : [];
  return {
    linked_accounts_count: linkedAccounts.length,
    default_method_configured: Boolean(normalized.default_method),
    automatic_withdrawal_enabled: Boolean(normalized.automatic_withdrawal),
    tax_form_status: normalized.tax_form_status || SECTION_DEFAULTS.payments.tax_form_status,
    payout_schedule: normalized.payout_schedule || SECTION_DEFAULTS.payments.payout_schedule,
    currency: normalized.currency || SECTION_DEFAULTS.payments.currency,
  };
};

const buildThemeAnalytics = (theme) => {
  const normalized = merge({}, SECTION_DEFAULTS.theme, theme || {});
  const customTokens = normalized.custom_tokens || {};
  const customTokenKeys = Object.keys(customTokens);
  const isCustomized =
    normalized.mode !== SECTION_DEFAULTS.theme.mode ||
    normalized.primary_color !== SECTION_DEFAULTS.theme.primary_color ||
    normalized.accent_color !== SECTION_DEFAULTS.theme.accent_color ||
    normalized.font_scale !== SECTION_DEFAULTS.theme.font_scale ||
    normalized.border_radius !== SECTION_DEFAULTS.theme.border_radius ||
    customTokenKeys.length > 0;

  return {
    is_customized: isCustomized,
    custom_tokens_count: customTokenKeys.length,
    mode: normalized.mode,
    primary_color: normalized.primary_color,
    accent_color: normalized.accent_color,
    font_scale: normalized.font_scale,
    border_radius: normalized.border_radius,
  };
};

const buildTokenAnalytics = async (userId) => {
  const [active, revoked, total] = await Promise.all([
    ApiToken.count({ where: { user_id: userId, revoked_at: null } }),
    ApiToken.count({ where: { user_id: userId, revoked_at: { [Op.ne]: null } }, paranoid: false }),
    ApiToken.count({ where: { user_id: userId }, paranoid: false }),
  ]);

  return {
    active_tokens: active,
    revoked_tokens: revoked,
    total_tokens: total,
  };
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
  const includeAnalytics = Boolean(options.analytics);
  const user = await User.findByPk(userId);
  if (!user) {
    throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  }
  const settings = await ensureSettings(userId);
  const account = merge({}, SECTION_DEFAULTS.account, settings.get('account') || {});

  const baseResponse = filterAccountResponse(
    {
      user: sanitizeUser(user),
      account,
    },
    splitFieldPaths(options.fields)
  );

  if (includeAnalytics) {
    baseResponse.analytics = await buildAccountAnalytics(userId);
  }

  return baseResponse;
};

const updateAccount = async (userId, payload, options = {}) => {
  const includeAnalytics = Boolean(options.analytics);
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
  const result = {
    user: sanitizeUser(sanitized),
    account: merge({}, SECTION_DEFAULTS.account, settings.get('account') || {}),
  };

  if (includeAnalytics) {
    result.analytics = await buildAccountAnalytics(userId);
  }

  return result;
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
    const now = new Date();
    const activeDevices = sessions.filter(
      (session) => !session.revoked_at && (!session.expires_at || session.expires_at > now)
    ).length;
    const revokedDevices = sessions.filter((session) => session.revoked_at).length;
    const expiredDevices = sessions.filter(
      (session) => !session.revoked_at && session.expires_at && session.expires_at <= now
    ).length;
    const lastActivity = sessions[0]?.updated_at || sessions[0]?.created_at || null;
    summary = {
      active_devices: activeDevices,
      revoked_devices: revokedDevices,
      expired_devices: expiredDevices,
      last_activity_at: lastActivity,
    };
  }

  return { devices, analytics: summary };
};

const getSecurity = async (userId, options = {}) => {
  const settings = await ensureSettings(userId);
  const security = merge({}, SECTION_DEFAULTS.security, settings.get('security') || {});
  const includeDeleted = options.includeDeleted === true;
  const includeAnalytics = Boolean(options.analytics);
  const { devices, analytics } = await listDevices(userId, {
    includeDeleted,
    currentSessionId: options.currentSessionId,
    analytics: includeAnalytics,
  });

  const response = {
    security: {
      two_factor_enabled: Boolean(security.two_factor_enabled),
      login_alerts: Boolean(security.login_alerts),
      recovery_codes_issued_at: security.recovery_codes_issued_at,
      recovery_codes_count: Array.isArray(security.recovery_codes) ? security.recovery_codes.length : 0,
      totp_issuer: security.totp_issuer || SECTION_DEFAULTS.security.totp_issuer,
    },
    devices,
  };

  if (includeAnalytics) {
    response.analytics = {
      ...(analytics || {}),
      two_factor_enabled: Boolean(security.two_factor_enabled),
      login_alerts: Boolean(security.login_alerts),
      recovery_codes_available: Array.isArray(security.recovery_codes)
        ? security.recovery_codes.length
        : 0,
      totp_issuer: security.totp_issuer || SECTION_DEFAULTS.security.totp_issuer,
    };
  } else if (analytics) {
    response.analytics = analytics;
  }

  return response;
};

const updateSecurity = async (userContext, payload, options = {}) => {
  const user = await User.scope('withSensitive').findByPk(userContext.id);
  if (!user) {
    throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  }

  const settings = await ensureSettings(user.id);
  const security = merge({}, SECTION_DEFAULTS.security, settings.get('security') || {});

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

  const includeAnalytics = Boolean(options.analytics);
  const result = await getSecurity(user.id, {
    includeDeleted: options.includeDeleted,
    currentSessionId: options.currentSessionId,
    analytics: includeAnalytics,
  });

  if (recoveryCodes) {
    result.recovery_codes = recoveryCodes;
    if (includeAnalytics && result.analytics) {
      result.analytics.recovery_codes_generated = recoveryCodes.length;
    }
  }

  return result;
};

const getPrivacy = async (userId, options = {}) => {
  const includeAnalytics = Boolean(options.analytics);
  const settings = await ensureSettings(userId);
  const privacy = merge({}, SECTION_DEFAULTS.privacy, settings.get('privacy') || {});

  if (includeAnalytics) {
    return { privacy, analytics: await buildPrivacyAnalytics(userId) };
  }

  return privacy;
};

const updatePrivacy = async (userId, payload, options = {}) => {
  const includeAnalytics = Boolean(options.analytics);
  const settings = await ensureSettings(userId);
  const merged = merge({}, SECTION_DEFAULTS.privacy, settings.get('privacy') || {}, payload);
  settings.set('privacy', merged);
  await settings.save();

  if (includeAnalytics) {
    return { privacy: merge({}, merged), analytics: await buildPrivacyAnalytics(userId) };
  }

  return merge({}, merged);
};

const getNotifications = async (userId, options = {}) => {
  const includeAnalytics = Boolean(options.analytics);
  const settings = await ensureSettings(userId);
  const notifications = merge({}, SECTION_DEFAULTS.notifications, settings.get('notifications') || {});

  if (includeAnalytics) {
    return { notifications, analytics: await buildNotificationAnalytics(userId) };
  }

  return notifications;
};

const updateNotifications = async (userId, payload, options = {}) => {
  const includeAnalytics = Boolean(options.analytics);
  const settings = await ensureSettings(userId);
  const merged = merge({}, SECTION_DEFAULTS.notifications, settings.get('notifications') || {}, payload);
  settings.set('notifications', merged);
  await settings.save();

  if (includeAnalytics) {
    return { notifications: merge({}, merged), analytics: await buildNotificationAnalytics(userId) };
  }

  return merge({}, merged);
};

const getPayments = async (userId, options = {}) => {
  const includeAnalytics = Boolean(options.analytics);
  const settings = await ensureSettings(userId);
  const payments = merge({}, SECTION_DEFAULTS.payments, settings.get('payments') || {});

  if (includeAnalytics) {
    return { payments, analytics: buildPaymentsAnalytics(payments) };
  }

  return payments;
};

const updatePayments = async (userId, payload, options = {}) => {
  const includeAnalytics = Boolean(options.analytics);
  const settings = await ensureSettings(userId);
  const merged = merge({}, SECTION_DEFAULTS.payments, settings.get('payments') || {}, payload);
  settings.set('payments', merged);
  await settings.save();

  if (includeAnalytics) {
    return { payments: merge({}, merged), analytics: buildPaymentsAnalytics(merged) };
  }

  return merge({}, merged);
};

const getTheme = async (userId, options = {}) => {
  const includeAnalytics = Boolean(options.analytics);
  const settings = await ensureSettings(userId);
  const theme = merge({}, SECTION_DEFAULTS.theme, settings.get('theme') || {});

  if (includeAnalytics) {
    return { theme, analytics: buildThemeAnalytics(theme) };
  }

  return theme;
};

const updateTheme = async (userId, payload, options = {}) => {
  const includeAnalytics = Boolean(options.analytics);
  const settings = await ensureSettings(userId);
  const merged = merge({}, SECTION_DEFAULTS.theme, settings.get('theme') || {}, payload);
  settings.set('theme', merged);
  await settings.save();

  if (includeAnalytics) {
    return { theme: merge({}, merged), analytics: buildThemeAnalytics(merged) };
  }

  return merge({}, merged);
};

const resetAccount = async (userId, options = {}) => {
  const includeAnalytics = Boolean(options.analytics);
  const user = await User.scope('withSensitive').findByPk(userId);
  if (!user) {
    throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  }

  const settings = await ensureSettings(userId);
  const defaults = cloneSectionDefaults('account');
  defaults.communication_email = user.email || defaults.communication_email || null;
  settings.set('account', defaults);
  await settings.save();

  const sanitized = await User.findByPk(userId);
  const result = {
    user: sanitizeUser(sanitized),
    account: merge({}, SECTION_DEFAULTS.account, settings.get('account') || {}),
  };

  if (includeAnalytics) {
    result.analytics = await buildAccountAnalytics(userId);
  }

  return result;
};

const resetSecurity = async (userId, options = {}) => {
  const includeAnalytics = Boolean(options.analytics);
  const includeDeleted = options.includeDeleted === true;
  const user = await User.scope('withSensitive').findByPk(userId);
  if (!user) {
    throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  }

  await sequelize.transaction(async (transaction) => {
    user.two_factor_secret = null;
    await user.save({ transaction });

    const settings = await ensureSettings(userId, transaction);
    settings.set('security', cloneSectionDefaults('security'));
    await settings.save({ transaction });

    await Session.update(
      { revoked_at: new Date() },
      { where: { user_id: userId }, transaction }
    );
  });

  return getSecurity(userId, {
    includeDeleted,
    currentSessionId: options.currentSessionId,
    analytics: includeAnalytics,
  });
};

const resetPrivacy = async (userId, options = {}) => {
  const includeAnalytics = Boolean(options.analytics);
  const settings = await ensureSettings(userId);
  const defaults = cloneSectionDefaults('privacy');
  settings.set('privacy', defaults);
  await settings.save();

  if (includeAnalytics) {
    return { privacy: merge({}, defaults), analytics: await buildPrivacyAnalytics(userId) };
  }

  return merge({}, defaults);
};

const resetNotifications = async (userId, options = {}) => {
  const includeAnalytics = Boolean(options.analytics);
  const settings = await ensureSettings(userId);
  const defaults = cloneSectionDefaults('notifications');
  settings.set('notifications', defaults);
  await settings.save();

  if (includeAnalytics) {
    return { notifications: merge({}, defaults), analytics: await buildNotificationAnalytics(userId) };
  }

  return merge({}, defaults);
};

const resetPayments = async (userId, options = {}) => {
  const includeAnalytics = Boolean(options.analytics);
  const settings = await ensureSettings(userId);
  const defaults = cloneSectionDefaults('payments');
  settings.set('payments', defaults);
  await settings.save();

  if (includeAnalytics) {
    return { payments: merge({}, defaults), analytics: buildPaymentsAnalytics(defaults) };
  }

  return merge({}, defaults);
};

const resetTheme = async (userId, options = {}) => {
  const includeAnalytics = Boolean(options.analytics);
  const settings = await ensureSettings(userId);
  const defaults = cloneSectionDefaults('theme');
  settings.set('theme', defaults);
  await settings.save();

  if (includeAnalytics) {
    return { theme: merge({}, defaults), analytics: buildThemeAnalytics(defaults) };
  }

  return merge({}, defaults);
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
  const includeAnalytics = query.analytics === true || query.analytics === 'true';

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
  if (includeAnalytics) {
    analytics = await buildTokenAnalytics(targetUserId);
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

const createApiToken = async (userContext, payload, { ip, userAgent, analytics: includeAnalytics } = {}) => {
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
  const response = {
    token: tokenValue,
    ...serialized,
  };

  if (includeAnalytics) {
    response.analytics = await buildTokenAnalytics(userContext.id);
  }

  return response;
};

const getApiToken = async (userContext, tokenId, options = {}) => {
  const includeDeleted = userContext.role === 'admin' && Boolean(options.includeDeleted);
  const includeAnalytics = Boolean(options.analytics);
  const token = await ApiToken.findByPk(tokenId, { paranoid: !includeDeleted });
  if (!token) {
    throw new ApiError(404, 'Token not found', 'TOKEN_NOT_FOUND');
  }

  if (token.user_id !== userContext.id && userContext.role !== 'admin') {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }

  const serialized = serializeToken(token);

  if (includeAnalytics) {
    serialized.analytics = await buildTokenAnalytics(token.user_id);
  }

  return serialized;
};

const updateApiToken = async (userContext, tokenId, payload, options = {}) => {
  const includeDeleted = userContext.role === 'admin' && Boolean(options.includeDeleted);
  const includeAnalytics = Boolean(options.analytics);
  const token = await ApiToken.findByPk(tokenId, { paranoid: false });
  if (!token) {
    throw new ApiError(404, 'Token not found', 'TOKEN_NOT_FOUND');
  }

  if (token.user_id !== userContext.id && userContext.role !== 'admin') {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }

  if (payload.restore) {
    if (userContext.role !== 'admin') {
      throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
    }
    if (token.deleted_at) {
      await token.restore();
      await token.reload({ paranoid: false });
    }
    token.revoked_at = null;
  }

  if (payload.revoke === false && token.revoked_at) {
    if (userContext.role !== 'admin') {
      throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
    }
    token.revoked_at = null;
    if (token.deleted_at) {
      await token.restore();
      await token.reload({ paranoid: false });
    }
  }

  if (payload.name !== undefined) {
    token.name = payload.name;
  }

  if (payload.scopes !== undefined) {
    token.scopes = payload.scopes;
  }

  if (payload.metadata !== undefined) {
    token.metadata = merge({}, token.metadata || {}, payload.metadata || {});
  }

  if (payload.expires_at !== undefined) {
    if (payload.expires_at === null) {
      token.expires_at = null;
    } else {
      const expiresAt = dayjs(payload.expires_at).toDate();
      if (expiresAt < new Date()) {
        throw new ApiError(400, 'Expiration must be in the future', 'INVALID_EXPIRATION');
      }
      token.expires_at = expiresAt;
    }
  }

  if (payload.revoke === true && !token.revoked_at) {
    token.revoked_at = new Date();
  }

  await token.save();

  if (payload.revoke === true) {
    await token.destroy();
    await token.reload({ paranoid: false });
  }

  if (!includeDeleted && token.deleted_at) {
    throw new ApiError(410, 'Token has been revoked', 'TOKEN_REVOKED');
  }

  const serialized = serializeToken(token);

  if (includeAnalytics) {
    serialized.analytics = await buildTokenAnalytics(token.user_id);
  }

  return serialized;
};

const revokeApiToken = async (userContext, tokenId, options = {}) => {
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

  const response = { success: true, revoked_at: token.revoked_at };

  if (Boolean(options.analytics)) {
    response.analytics = await buildTokenAnalytics(token.user_id);
  }

  return response;
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
  getApiToken,
  createApiToken,
  updateApiToken,
  revokeApiToken,
};
