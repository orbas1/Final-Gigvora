const crypto = require('crypto');
const speakeasy = require('speakeasy');
const dayjs = require('dayjs');
const bcrypt = require('bcrypt');
const { v4: uuid } = require('uuid');
const { ApiError } = require('../middleware/errorHandler');
const {
  User,
  Session,
  EmailVerification,
  PasswordReset,
  OtpCode,
  Profile,
  sequelize,
} = require('../models');
const { generateToken, generateRefreshToken, tokenExpiresAt } = require('../utils/token');
const { aggregateByPeriod } = require('../utils/analytics');
const config = require('../config');
const { sendMail } = require('../lib/mailer');
const { persistIdempotentResponse } = require('../middleware/idempotency');

const buildAuthResponse = async (req, res, user, session, status = 200) => {
  const token = generateToken({ sub: user.id, role: user.role, sessionId: session.id });
  const refreshToken = generateRefreshToken({ sub: user.id, sessionId: session.id });
  const refreshHash = await bcrypt.hash(refreshToken, 10);
  session.refresh_token_hash = refreshHash;
  await session.save();

  const payload = {
    access_token: token,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_at: tokenExpiresAt(token),
    user,
  };
  await persistIdempotentResponse(req, res, { status, body: payload });
  return payload;
};

const register = async (req, res, body) => {
  const { email, password, role = 'user', org } = body;
  const existing = await User.scope('withSensitive').findOne({ where: { email } });
  if (existing) {
    throw new ApiError(409, 'Email already registered', 'EMAIL_TAKEN');
  }

  return sequelize.transaction(async (transaction) => {
    const user = await User.create(
      {
        email,
        password_hash: password,
        role,
        active_role: role,
        org_id: org || null,
      },
      { transaction }
    );

    await Profile.create(
      {
        user_id: user.id,
        display_name: email.split('@')[0],
      },
      { transaction }
    );

    const session = await Session.create(
      {
        user_id: user.id,
        user_agent: req.headers['user-agent'],
        ip_address: req.ip,
        refresh_token_hash: await bcrypt.hash(uuid(), 10),
        expires_at: dayjs().add(30, 'day').toDate(),
      },
      { transaction }
    );

    const token = crypto.randomBytes(32).toString('hex');
    await EmailVerification.create(
      {
        user_id: user.id,
        token,
        expires_at: dayjs().add(1, 'day').toDate(),
      },
      { transaction }
    );

    await sendMail({
      to: user.email,
      subject: 'Verify your email',
      text: `Use this token to verify your email: ${token}`,
    });

    const authResponse = await buildAuthResponse(req, res, user, session, 201);
    return authResponse;
  });
};

const login = async (req, res, body) => {
  const { email, password, otp } = body;
  const user = await User.scope('withSensitive').findOne({ where: { email } });
  if (!user) {
    throw new ApiError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
  }
  const valid = await user.validatePassword(password);
  if (!valid) {
    throw new ApiError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
  }

  if (user.two_factor_secret) {
    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token: otp,
    });
    if (!verified) {
      throw new ApiError(401, 'Invalid two factor token', 'INVALID_OTP');
    }
  }

  const session = await Session.create({
    user_id: user.id,
    user_agent: req.headers['user-agent'],
    ip_address: req.ip,
    refresh_token_hash: await bcrypt.hash(uuid(), 10),
    expires_at: dayjs().add(30, 'day').toDate(),
  });

  user.last_login_at = new Date();
  await user.save();

  return buildAuthResponse(req, res, await User.findByPk(user.id), session);
};

const refresh = async (req, res, body) => {
  const { refresh_token: refreshToken } = body;
  if (!refreshToken) {
    throw new ApiError(400, 'refresh_token is required', 'MISSING_REFRESH_TOKEN');
  }
  const payload = require('../utils/token').verifyToken(refreshToken, { refresh: true });
  const session = await Session.findOne({ where: { id: payload.sessionId, revoked_at: null } });
  if (!session || dayjs(session.expires_at).isBefore(dayjs())) {
    throw new ApiError(401, 'Refresh token expired', 'REFRESH_EXPIRED');
  }
  const valid = await bcrypt.compare(refreshToken, session.refresh_token_hash || '');
  if (!valid) {
    throw new ApiError(401, 'Refresh token invalid', 'REFRESH_INVALID');
  }
  const user = await User.findByPk(payload.sub);
  if (!user) {
    throw new ApiError(401, 'User not found', 'USER_NOT_FOUND');
  }
  return buildAuthResponse(req, res, user, session);
};

const logout = async (user, session) => {
  if (session) {
    session.revoked_at = new Date();
    await session.save();
  }
  return { success: true };
};

const forgotPassword = async (body) => {
  const { email } = body;
  const user = await User.findOne({ where: { email } });
  if (!user) {
    return { success: true };
  }
  const token = crypto.randomBytes(32).toString('hex');
  await PasswordReset.create({
    user_id: user.id,
    token,
    expires_at: dayjs().add(1, 'hour').toDate(),
  });
  await sendMail({
    to: user.email,
    subject: 'Reset your password',
    text: `Use this token to reset: ${token}`,
  });
  return { success: true };
};

const resetPassword = async (body) => {
  const { token, password } = body;
  const reset = await PasswordReset.findOne({ where: { token, consumed_at: null } });
  if (!reset || dayjs(reset.expires_at).isBefore(dayjs())) {
    throw new ApiError(400, 'Invalid or expired reset token', 'RESET_TOKEN_INVALID');
  }
  const user = await User.scope('withSensitive').findByPk(reset.user_id);
  user.password_hash = password;
  await user.save();
  reset.consumed_at = new Date();
  await reset.save();
  return { success: true };
};

const verifyEmail = async (body) => {
  const { token } = body;
  const verification = await EmailVerification.findOne({ where: { token, consumed_at: null } });
  if (!verification || dayjs(verification.expires_at).isBefore(dayjs())) {
    throw new ApiError(400, 'Invalid or expired token', 'VERIFY_TOKEN_INVALID');
  }
  const user = await User.findByPk(verification.user_id);
  user.is_verified = true;
  await user.save();
  verification.consumed_at = new Date();
  await verification.save();
  return { success: true };
};

const sendOtp = async (body) => {
  const { email } = body;
  const user = await User.findOne({ where: { email } });
  if (!user) {
    return { success: true };
  }
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  await OtpCode.create({
    user_id: user.id,
    code,
    channel: 'email',
    expires_at: dayjs().add(config.otp.ttlMinutes, 'minute').toDate(),
  });
  await sendMail({ to: user.email, subject: 'Your OTP code', text: `Code: ${code}` });
  return { success: true };
};

const setup2fa = async (user) => {
  const secret = speakeasy.generateSecret({ length: 20 });
  user.two_factor_secret = secret.base32;
  await user.save();
  return { secret: secret.base32, otpauth_url: secret.otpauth_url };
};

const verify2fa = async (user, body) => {
  const { token } = body;
  if (!user.two_factor_secret) {
    throw new ApiError(400, '2FA not initiated', 'TWO_FA_NOT_SETUP');
  }
  const verified = speakeasy.totp.verify({
    secret: user.two_factor_secret,
    encoding: 'base32',
    token,
  });
  if (!verified) {
    throw new ApiError(400, 'Invalid token', 'INVALID_OTP');
  }
  return { success: true };
};

const disable2fa = async (user) => {
  user.two_factor_secret = null;
  await user.save();
  return { success: true };
};

const switchRole = async (user, body) => {
  const { role, org_id } = body;
  user.active_role = role;
  if (org_id) {
    user.org_id = org_id;
  }
  await user.save();
  return user;
};

const analyticsRegistrations = async ({ from, to, by = 'day' }) => {
  const period = by === 'month' ? 'month' : by === 'week' ? 'week' : 'day';
  const rangeStart = from || dayjs().subtract(30, 'day').toDate();
  const rangeEnd = to || new Date();

  return aggregateByPeriod(User, 'created_at', {
    granularity: period,
    from: rangeStart,
    to: rangeEnd,
  });
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  sendOtp,
  setup2fa,
  verify2fa,
  disable2fa,
  switchRole,
  analyticsRegistrations,
};
