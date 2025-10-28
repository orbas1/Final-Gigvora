const crypto = require('crypto');
const merge = require('lodash/merge');
const pick = require('lodash/pick');
const dayjs = require('dayjs');
const speakeasy = require('speakeasy');
const { Op } = require('sequelize');
const config = require('../config');
const {
  sequelize,
  User,
  Profile,
  UserSetting,
  Session,
  ApiToken,
  WalletPaymentMethod,
  WalletPayoutAccount,
} = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const walletService = require('./walletService');
const notificationService = require('./notificationService');
const { buildPagination, encodeCursor } = require('../utils/pagination');

const likeOperator = sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like;

const ACCOUNT_DEFAULTS = {
  language: 'en',
  timezone: 'UTC',
  week_start: 'monday',
  currency: 'USD',
  communication_email: null,
};

const SECURITY_DEFAULTS = {
  two_factor_enabled: false,
  device_verification: true,
  login_notifications: { email: true, push: true },
  allowed_ips: [],
  password_updated_at: null,
};

const PRIVACY_DEFAULTS = {
  profile_visibility: 'public',
  search_engine_indexing: true,
  message_privacy: 'anyone',
  activity_status: 'online',
  data_sharing: { analytics: true, partners: false },
};

const PAYMENTS_DEFAULTS = {
  payout_schedule: 'weekly',
  auto_withdraw: false,
  default_payment_method_id: null,
  default_payout_account_id: null,
  invoicing: { auto_generate: true, net_terms: 'net_15' },
  tax_profile: { country: null, vat_number: null },
};

const THEME_DEFAULTS = {
  mode: 'system',
  accent_color: '#4f46e5',
  density: 'comfortable',
};

const THEME_TOKEN_DEFAULTS = {
  '--color-primary': '#4f46e5',
  '--color-surface': '#ffffff',
  '--color-surface-dark': '#111827',
  '--radius-base': '0.75rem',
  '--shadow-elevation': '0 12px 32px rgba(15, 23, 42, 0.12)',
};

const NOTIFICATION_ADVANCED_DEFAULTS = {
  quiet_hours: { enabled: false, from: '22:00', to: '07:00' },
  product_updates: { email: false, in_app: true },
};

const API_PREFERENCES_DEFAULTS = {
  ip_allowlist: [],
};

const toBoolean = (value) => value === true || value === 'true' || value === 1 || value === '1';

const ensureSettings = async (userId, { transaction } = {}) => {
  const [settings] = await UserSetting.findOrCreate({
    where: { user_id: userId },
    defaults: {
      account: ACCOUNT_DEFAULTS,
      security: SECURITY_DEFAULTS,
      privacy: PRIVACY_DEFAULTS,
      notifications: NOTIFICATION_ADVANCED_DEFAULTS,
      payments: PAYMENTS_DEFAULTS,
      theme: THEME_DEFAULTS,
      theme_tokens: THEME_TOKEN_DEFAULTS,
      api_preferences: API_PREFERENCES_DEFAULTS,
    },
    transaction,
  });
  return settings;
};

const applyDefaults = (current, defaults) => merge({}, defaults, current || {});

const sanitizeSession = (session) => {
  if (!session) return null;
  const json = session.toJSON();
  return pick(json, ['id', 'user_agent', 'ip_address', 'created_at', 'updated_at', 'expires_at', 'revoked_at']);
};

const sanitizePaymentMethod = (method) => {
  if (!method) return null;
  const json = method.toJSON();
  return pick(json, [
    'id',
    'type',
    'label',
    'brand',
    'last4',
    'exp_month',
    'exp_year',
    'country',
    'is_default',
    'status',
    'created_at',
    'updated_at',
  ]);
};

const sanitizePayoutAccount = (account) => {
  if (!account) return null;
  const json = account.toJSON();
  return pick(json, [
    'id',
    'type',
    'account_holder_name',
    'account_identifier_last4',
    'bank_name',
    'currency',
    'country',
    'status',
    'verified_at',
    'created_at',
    'updated_at',
  ]);
};

const sanitizeApiToken = (token) => {
  if (!token) return null;
  const json = token.toJSON();
  return pick(json, [
    'id',
    'user_id',
    'name',
    'description',
    'token_prefix',
    'token_last4',
    'scopes',
    'status',
    'ip_allowlist',
    'metadata',
    'last_used_at',
    'last_used_ip',
    'expires_at',
    'created_at',
    'updated_at',
    'deleted_at',
  ]);
};

const getAccount = async (userId) => {
  const user = await User.findByPk(userId, {
    include: [
      { model: Profile, as: 'profile', paranoid: false },
      { model: UserSetting, as: 'settings', paranoid: false },
    ],
  });
  if (!user) {
    throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  }
  const settings = user.settings || (await ensureSettings(userId));
  const account = applyDefaults(settings.account, ACCOUNT_DEFAULTS);
  const preferences = { ...account, communication_email: account.communication_email || user.email };

  return {
    user: pick(user.toJSON(), [
      'id',
      'email',
      'role',
      'active_role',
      'status',
      'is_verified',
      'last_login_at',
      'created_at',
      'updated_at',
    ]),
    profile: user.profile ? pick(user.profile.toJSON(), ['display_name', 'headline', 'location']) : null,
    preferences,
  };
};

const updateAccount = async (userId, payload) =>
  sequelize.transaction(async (transaction) => {
    const user = await User.scope('withSensitive').findByPk(userId, {
      include: [{ model: UserSetting, as: 'settings', paranoid: false }],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!user) {
      throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
    }

    if (payload.email && payload.email !== user.email) {
      const existing = await User.count({ where: { email: payload.email }, transaction });
      if (existing) {
        throw new ApiError(409, 'Email already in use', 'EMAIL_TAKEN');
      }
      user.email = payload.email;
    }

    if (payload.communication_email) {
      const validEmail = String(payload.communication_email).trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(validEmail)) {
        throw new ApiError(400, 'communication_email must be a valid email', 'VALIDATION_ERROR');
      }
    }

    const settings = user.settings || (await ensureSettings(userId, { transaction }));
    const account = applyDefaults(settings.account, ACCOUNT_DEFAULTS);

    ['language', 'timezone', 'week_start', 'currency'].forEach((field) => {
      if (payload[field]) {
        account[field] = payload[field];
      }
    });

    if (payload.communication_email !== undefined) {
      account.communication_email = payload.communication_email ? payload.communication_email : null;
    }

    let profile = await Profile.findOne({ where: { user_id: userId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!profile) {
      profile = await Profile.create(
        {
          user_id: userId,
          display_name: payload.display_name || null,
          headline: payload.headline || null,
          location: payload.location || null,
        },
        { transaction }
      );
    } else {
      const profileUpdates = {};
      ['display_name', 'headline', 'location'].forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(payload, field)) {
          profileUpdates[field] = payload[field];
        }
      });
      if (Object.keys(profileUpdates).length) {
        await profile.update(profileUpdates, { transaction });
      }
    }

    settings.account = account;
    await Promise.all([user.save({ transaction }), settings.save({ transaction })]);

    return getAccount(userId);
  });

const getSecurity = async (userId, { analytics = false } = {}) => {
  const [settings, user, sessions] = await Promise.all([
    ensureSettings(userId),
    User.scope('withSensitive').findByPk(userId),
    Session.findAll({ where: { user_id: userId }, order: [['created_at', 'DESC']], paranoid: false }),
  ]);
  if (!user) {
    throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  }

  const security = applyDefaults(settings.security, SECURITY_DEFAULTS);
  security.two_factor_enabled = Boolean(user.two_factor_secret);

  const activeSessions = sessions.filter((session) => !session.revoked_at);
  const sessionData = sessions.map(sanitizeSession);

  let analyticsPayload;
  if (analytics) {
    const now = dayjs();
    const recentCutoff = now.subtract(30, 'day').toDate();
    const recentLogins = activeSessions.filter((session) => session.updated_at && session.updated_at >= recentCutoff);
    const uniqueIps = new Set(activeSessions.map((session) => session.ip_address).filter(Boolean));
    const recentRevocations = sessions.filter((session) => session.revoked_at && session.revoked_at >= recentCutoff);
    analyticsPayload = {
      active_sessions: activeSessions.length,
      recent_sign_ins: recentLogins.length,
      unique_active_ips: uniqueIps.size,
      recent_revocations: recentRevocations.length,
      password_last_changed: security.password_updated_at,
    };
  }

  return {
    preferences: security,
    sessions: sessionData,
    analytics: analyticsPayload,
  };
};

const updateSecurity = async (user, payload, { currentSessionId } = {}) =>
  sequelize.transaction(async (transaction) => {
    const dbUser = await User.scope('withSensitive').findByPk(user.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!dbUser) {
      throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
    }
    const settings = await ensureSettings(user.id, { transaction });
    const security = applyDefaults(settings.security, SECURITY_DEFAULTS);

    let provisioning;

    if (Object.prototype.hasOwnProperty.call(payload, 'two_factor_enabled')) {
      const enable = Boolean(payload.two_factor_enabled);
      if (enable && !dbUser.two_factor_secret) {
        const secret = speakeasy.generateSecret({ length: 32, name: `Gigvora (${dbUser.email})` });
        dbUser.two_factor_secret = secret.base32;
        security.two_factor_enabled = true;
        security.two_factor_issued_at = new Date().toISOString();
        provisioning = {
          otpauth_url: secret.otpauth_url,
          base32: secret.base32,
          issuer: secret.issuer,
        };
      } else if (!enable) {
        dbUser.two_factor_secret = null;
        security.two_factor_enabled = false;
        security.two_factor_disabled_at = new Date().toISOString();
      }
    }

    if (payload.login_notifications) {
      security.login_notifications = merge({}, security.login_notifications || {}, payload.login_notifications);
    }

    if (payload.allowed_ips) {
      security.allowed_ips = Array.from(new Set(payload.allowed_ips.map((ip) => String(ip).trim()).filter(Boolean)));
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'device_verification')) {
      security.device_verification = Boolean(payload.device_verification);
    }

    if (payload.password) {
      const { current_password: currentPassword, new_password: newPassword } = payload.password;
      if (!currentPassword || !newPassword) {
        throw new ApiError(400, 'Both current_password and new_password are required', 'VALIDATION_ERROR');
      }
      const valid = await dbUser.validatePassword(currentPassword);
      if (!valid) {
        throw new ApiError(400, 'Current password is incorrect', 'INVALID_PASSWORD');
      }
      if (String(newPassword).length < 8) {
        throw new ApiError(400, 'New password must be at least 8 characters', 'PASSWORD_TOO_SHORT');
      }
      dbUser.password_hash = newPassword;
      security.password_updated_at = new Date().toISOString();
    }

    settings.security = security;
    await Promise.all([dbUser.save({ transaction }), settings.save({ transaction })]);

    if (Array.isArray(payload.revoke_session_ids) && payload.revoke_session_ids.length) {
      await Session.update(
        { revoked_at: new Date() },
        {
          where: { user_id: user.id, id: { [Op.in]: payload.revoke_session_ids } },
          transaction,
        }
      );
    }

    if (payload.global_logout) {
      const where = { user_id: user.id, revoked_at: null };
      if (currentSessionId) {
        where.id = { [Op.ne]: currentSessionId };
      }
      await Session.update({ revoked_at: new Date() }, { where, transaction });
    }

    const result = await getSecurity(user.id);
    if (provisioning) {
      result.provisioning = provisioning;
    }
    return result;
  });

const getPrivacy = async (userId) => {
  const settings = await ensureSettings(userId);
  return applyDefaults(settings.privacy, PRIVACY_DEFAULTS);
};

const updatePrivacy = async (userId, payload) =>
  sequelize.transaction(async (transaction) => {
    const settings = await ensureSettings(userId, { transaction });
    const privacy = applyDefaults(settings.privacy, PRIVACY_DEFAULTS);
    if (payload.profile_visibility) {
      privacy.profile_visibility = payload.profile_visibility;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'search_engine_indexing')) {
      privacy.search_engine_indexing = Boolean(payload.search_engine_indexing);
    }
    if (payload.message_privacy) {
      privacy.message_privacy = payload.message_privacy;
    }
    if (payload.activity_status) {
      privacy.activity_status = payload.activity_status;
    }
    if (payload.data_sharing) {
      privacy.data_sharing = merge({}, privacy.data_sharing || {}, payload.data_sharing);
    }
    settings.privacy = privacy;
    await settings.save({ transaction });
    return privacy;
  });

const getNotifications = async (userId) => {
  const [settings, preferences] = await Promise.all([
    ensureSettings(userId),
    notificationService.getPreferences(userId),
  ]);
  const advanced = applyDefaults(settings.notifications, NOTIFICATION_ADVANCED_DEFAULTS);
  return { preferences, advanced };
};

const updateNotifications = async (userId, payload) => {
  const { channels, digest, ...rest } = payload || {};
  const updates = {};
  if (channels !== undefined) {
    updates.channels = channels;
  }
  if (digest !== undefined) {
    updates.digest = digest;
  }
  const preferences = Object.keys(updates).length
    ? await notificationService.updatePreferences(userId, updates)
    : await notificationService.getPreferences(userId);

  let advanced;
  if (Object.keys(rest).length) {
    const settings = await ensureSettings(userId);
    const merged = applyDefaults(settings.notifications, NOTIFICATION_ADVANCED_DEFAULTS);
    advanced = merge({}, merged, rest);
    settings.notifications = advanced;
    await settings.save();
  } else {
    const settings = await ensureSettings(userId);
    advanced = applyDefaults(settings.notifications, NOTIFICATION_ADVANCED_DEFAULTS);
  }

  return { preferences, advanced };
};

const computeWalletAnalytics = async (walletId) => {
  const [activeMethods, inactiveMethods, payoutAccounts] = await Promise.all([
    WalletPaymentMethod.count({ where: { wallet_id: walletId, status: 'active' } }),
    WalletPaymentMethod.count({
      where: { wallet_id: walletId, status: { [Op.ne]: 'active' } },
      paranoid: false,
    }),
    WalletPayoutAccount.count({ where: { wallet_id: walletId } }),
  ]);
  return {
    payment_methods: { active: activeMethods, inactive: inactiveMethods },
    payout_accounts: payoutAccounts,
  };
};

const getPayments = async (userId, { analytics = false } = {}) => {
  const [settings, wallet] = await Promise.all([ensureSettings(userId), walletService.ensureWallet(userId)]);
  const preferences = applyDefaults(settings.payments, PAYMENTS_DEFAULTS);

  const [defaultMethod, defaultPayout] = await Promise.all([
    preferences.default_payment_method_id
      ? WalletPaymentMethod.findOne({
          where: { id: preferences.default_payment_method_id, wallet_id: wallet.id },
          paranoid: false,
        })
      : WalletPaymentMethod.findOne({ where: { wallet_id: wallet.id, is_default: true } }),
    preferences.default_payout_account_id
      ? WalletPayoutAccount.findOne({
          where: { id: preferences.default_payout_account_id, wallet_id: wallet.id },
          paranoid: false,
        })
      : WalletPayoutAccount.findOne({ where: { wallet_id: wallet.id }, order: [['created_at', 'ASC']] }),
  ]);

  const response = {
    wallet: await walletService.getBalances(userId),
    preferences,
    default_payment_method: sanitizePaymentMethod(defaultMethod),
    default_payout_account: sanitizePayoutAccount(defaultPayout),
  };

  if (analytics) {
    response.analytics = await computeWalletAnalytics(wallet.id);
  }

  return response;
};

const setDefaultPaymentMethod = async (walletId, methodId, transaction) => {
  const method = await WalletPaymentMethod.findOne({
    where: { id: methodId, wallet_id: walletId },
    transaction,
  });
  if (!method) {
    throw new ApiError(404, 'Payment method not found', 'PAYMENT_METHOD_NOT_FOUND');
  }
  if (method.deleted_at) {
    throw new ApiError(400, 'Cannot use a deleted payment method', 'PAYMENT_METHOD_DELETED');
  }
  if (!method.is_default) {
    await WalletPaymentMethod.update(
      { is_default: false },
      { where: { wallet_id: walletId, id: { [Op.ne]: methodId } }, transaction }
    );
    method.is_default = true;
    await method.save({ transaction });
  }
  return method;
};

const updatePayments = async (userId, payload) =>
  sequelize.transaction(async (transaction) => {
    const wallet = await walletService.ensureWallet(userId, { transaction });
    const settings = await ensureSettings(userId, { transaction });
    const preferences = applyDefaults(settings.payments, PAYMENTS_DEFAULTS);

    if (payload.default_payment_method_id) {
      const method = await setDefaultPaymentMethod(wallet.id, payload.default_payment_method_id, transaction);
      preferences.default_payment_method_id = method.id;
    }

    if (payload.default_payout_account_id) {
      const account = await WalletPayoutAccount.findOne({
        where: { id: payload.default_payout_account_id, wallet_id: wallet.id },
        transaction,
      });
      if (!account) {
        throw new ApiError(404, 'Payout account not found', 'PAYOUT_ACCOUNT_NOT_FOUND');
      }
      if (account.deleted_at) {
        throw new ApiError(400, 'Cannot use a deleted payout account', 'PAYOUT_ACCOUNT_DELETED');
      }
      preferences.default_payout_account_id = account.id;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'payout_schedule')) {
      preferences.payout_schedule = payload.payout_schedule;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'auto_withdraw')) {
      preferences.auto_withdraw = Boolean(payload.auto_withdraw);
    }
    if (payload.invoicing) {
      preferences.invoicing = merge({}, preferences.invoicing || {}, payload.invoicing);
    }
    if (payload.tax_profile) {
      preferences.tax_profile = merge({}, preferences.tax_profile || {}, payload.tax_profile);
    }

    settings.payments = preferences;
    await settings.save({ transaction });

    return getPayments(userId);
  });

const getTheme = async (userId) => {
  const settings = await ensureSettings(userId);
  return {
    theme: applyDefaults(settings.theme, THEME_DEFAULTS),
    tokens: applyDefaults(settings.theme_tokens, THEME_TOKEN_DEFAULTS),
  };
};

const updateTheme = async (userId, payload) =>
  sequelize.transaction(async (transaction) => {
    const settings = await ensureSettings(userId, { transaction });
    const theme = applyDefaults(settings.theme, THEME_DEFAULTS);
    const tokens = applyDefaults(settings.theme_tokens, THEME_TOKEN_DEFAULTS);

    if (payload.theme) {
      merge(theme, payload.theme);
    }
    if (payload.tokens) {
      merge(tokens, payload.tokens);
    }

    settings.theme = theme;
    settings.theme_tokens = tokens;
    await settings.save({ transaction });
    return { theme, tokens };
  });

const hashToken = (value) => crypto.createHash('sha256').update(value).digest('hex');

const generateTokenValue = () => {
  const prefix = config.apiTokens?.prefix || 'gvtok';
  const length = Number(config.apiTokens?.length || 48);
  const bytes = Math.ceil(length / 2);
  const raw = crypto.randomBytes(bytes).toString('hex').slice(0, length);
  const token = `${prefix}_${raw}`;
  return {
    token,
    prefix: token.slice(0, 12),
    last4: token.slice(-4),
  };
};

const assertApiTokenLimit = async (userId) => {
  const limit = Number(config.apiTokens?.maxPerUser || 0);
  if (!limit) return;
  const count = await ApiToken.count({ where: { user_id: userId }, paranoid: false });
  if (count >= limit) {
    throw new ApiError(429, 'API token limit reached', 'API_TOKEN_LIMIT');
  }
};

const listApiTokens = async (user, query = {}) => {
  const pagination = buildPagination(query, ['created_at', 'last_used_at', 'name']);
  const baseWhere = { user_id: user.id };
  if (query.q) {
    const term = `%${String(query.q).toLowerCase()}%`;
    baseWhere[Op.or] = [
      { name: { [likeOperator]: term } },
      { token_prefix: { [likeOperator]: term } },
      { description: { [likeOperator]: term } },
    ];
  }
  const paranoid = !(query.include === 'deleted' && user.role === 'admin');

  const findWhere = { ...baseWhere };
  if (pagination.cursorValue !== undefined) {
    findWhere[pagination.sortField] = { [pagination.cursorOperator]: pagination.cursorValue };
  }

  const [rows, total] = await Promise.all([
    ApiToken.findAll({
      where: findWhere,
      order: pagination.order,
      limit: pagination.limit + 1,
      paranoid,
    }),
    ApiToken.count({ where: baseWhere, paranoid }),
  ]);

  const hasMore = rows.length > pagination.limit;
  const dataRows = hasMore ? rows.slice(0, pagination.limit) : rows;
  const data = dataRows.map(sanitizeApiToken);
  const nextCursorValue = hasMore ? dataRows[dataRows.length - 1][pagination.sortField] : null;

  let analytics;
  if (toBoolean(query.analytics)) {
    const now = dayjs();
    const [active, revoked, expiredSoon] = await Promise.all([
      ApiToken.count({ where: { user_id: user.id, status: 'active' } }),
      ApiToken.count({ where: { user_id: user.id, status: 'revoked' }, paranoid: false }),
      ApiToken.count({
        where: {
          user_id: user.id,
          status: 'active',
          expires_at: { [Op.and]: [{ [Op.ne]: null }, { [Op.lte]: now.add(30, 'day').toDate() }] },
        },
      }),
    ]);
    analytics = { total, active, revoked, expiring_soon: expiredSoon };
  }

  return {
    data,
    total,
    page: {
      next_cursor: hasMore ? encodeCursor(nextCursorValue) : null,
      limit: pagination.limit,
      sort: pagination.sortField,
      sort_direction: pagination.sortDirection,
    },
    analytics,
  };
};

const getApiToken = async (user, id, { includeDeleted = false } = {}) => {
  const token = await ApiToken.findOne({
    where: { id, user_id: user.id },
    paranoid: !includeDeleted,
  });
  if (!token) {
    throw new ApiError(404, 'API token not found', 'API_TOKEN_NOT_FOUND');
  }
  return sanitizeApiToken(token);
};

const createApiToken = async (user, payload) => {
  await assertApiTokenLimit(user.id);
  const { token, prefix, last4 } = generateTokenValue();
  const ipAllowlist = payload.ip_allowlist
    ? Array.from(new Set(payload.ip_allowlist.map((ip) => String(ip).trim()).filter(Boolean)))
    : null;

  let expiresAt = payload.expires_at ? dayjs(payload.expires_at).toDate() : null;
  if (!expiresAt) {
    const defaultExpiryDays = Number(config.apiTokens?.defaultExpiryDays || 0);
    if (defaultExpiryDays > 0) {
      expiresAt = dayjs().add(defaultExpiryDays, 'day').toDate();
    }
  }
  const record = await ApiToken.create({
    user_id: user.id,
    name: payload.name,
    description: payload.description || null,
    token_hash: hashToken(token),
    token_prefix: prefix,
    token_last4: last4,
    scopes: payload.scopes || [],
    ip_allowlist: ipAllowlist,
    metadata: payload.metadata || null,
    expires_at: expiresAt,
    status: 'active',
  });

  if (ipAllowlist) {
    const settings = await ensureSettings(user.id);
    const apiPrefs = applyDefaults(settings.api_preferences, API_PREFERENCES_DEFAULTS);
    apiPrefs.ip_allowlist = ipAllowlist;
    settings.api_preferences = apiPrefs;
    await settings.save();
  }

  const sanitized = sanitizeApiToken(record);
  return { ...sanitized, token };
};

const updateApiToken = async (user, id, payload) =>
  sequelize.transaction(async (transaction) => {
    const token = await ApiToken.findOne({
      where: { id, user_id: user.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
      paranoid: false,
    });
    if (!token) {
      throw new ApiError(404, 'API token not found', 'API_TOKEN_NOT_FOUND');
    }
    if (token.deleted_at) {
      throw new ApiError(404, 'API token not found', 'API_TOKEN_NOT_FOUND');
    }

    if (payload.name) {
      token.name = payload.name;
    }
    if (payload.description !== undefined) {
      token.description = payload.description;
    }
    if (payload.scopes) {
      token.scopes = payload.scopes;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'status')) {
      token.status = payload.status;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'expires_at')) {
      token.expires_at = payload.expires_at ? dayjs(payload.expires_at).toDate() : null;
    }
    let updatedIpAllowlist;
    if (payload.ip_allowlist) {
      updatedIpAllowlist = Array.from(
        new Set(payload.ip_allowlist.map((ip) => String(ip).trim()).filter(Boolean))
      );
      token.ip_allowlist = updatedIpAllowlist;
    }
    if (payload.metadata) {
      token.metadata = merge({}, token.metadata || {}, payload.metadata);
    }

    await token.save({ transaction });

    if (updatedIpAllowlist) {
      const settings = await ensureSettings(user.id, { transaction });
      const apiPrefs = applyDefaults(settings.api_preferences, API_PREFERENCES_DEFAULTS);
      apiPrefs.ip_allowlist = updatedIpAllowlist;
      settings.api_preferences = apiPrefs;
      await settings.save({ transaction });
    }

    return sanitizeApiToken(token);
  });

const deleteApiToken = async (user, id) => {
  const token = await ApiToken.findOne({
    where: { id, user_id: user.id },
    paranoid: false,
  });
  if (!token) {
    throw new ApiError(404, 'API token not found', 'API_TOKEN_NOT_FOUND');
  }

  if (token.status !== 'revoked') {
    token.status = 'revoked';
    await token.save();
  }

  if (!token.deleted_at) {
    await token.destroy();
  }

  return { success: true };
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
