const Joi = require('joi');
const authService = require('../services/authService');
const { ApiError } = require('../middleware/errorHandler');

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', { errors: error.details });
  }
  return value;
};

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  role: Joi.string().valid('user', 'freelancer', 'client', 'admin').default('user'),
  org: Joi.string().uuid().optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  otp: Joi.string().length(6).optional(),
});

const refreshSchema = Joi.object({ refresh_token: Joi.string().required() });
const forgotSchema = Joi.object({ email: Joi.string().email().required() });
const resetSchema = Joi.object({ token: Joi.string().required(), password: Joi.string().min(8).required() });
const verifySchema = Joi.object({ token: Joi.string().required() });
const otpSchema = Joi.object({ email: Joi.string().email().required() });
const switchRoleSchema = Joi.object({ role: Joi.string().required(), org_id: Joi.string().uuid().optional() });
const analyticsSchema = Joi.object({
  from: Joi.date().optional(),
  to: Joi.date().optional(),
  by: Joi.string().valid('day', 'week', 'month').default('day'),
});

const register = async (req, res, next) => {
  try {
    const payload = validate(registerSchema, req.body);
    const result = await authService.register(req, res, payload);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const payload = validate(loginSchema, req.body);
    const result = await authService.login(req, res, payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const refresh = async (req, res, next) => {
  try {
    const payload = validate(refreshSchema, req.body);
    const result = await authService.refresh(req, res, payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    const result = await authService.logout(req.user, req.session);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const forgot = async (req, res, next) => {
  try {
    const payload = validate(forgotSchema, req.body);
    const result = await authService.forgotPassword(payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const reset = async (req, res, next) => {
  try {
    const payload = validate(resetSchema, req.body);
    const result = await authService.resetPassword(payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    const payload = validate(verifySchema, req.body);
    const result = await authService.verifyEmail(payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const sendOtp = async (req, res, next) => {
  try {
    const payload = validate(otpSchema, req.body);
    const result = await authService.sendOtp(payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const setup2fa = async (req, res, next) => {
  try {
    const result = await authService.setup2fa(req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const verify2fa = async (req, res, next) => {
  try {
    const payload = validate(Joi.object({ token: Joi.string().required() }), req.body);
    const result = await authService.verify2fa(req.user, payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const disable2fa = async (req, res, next) => {
  try {
    const result = await authService.disable2fa(req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const me = async (req, res) => {
  res.json({ user: req.user });
};

const switchRole = async (req, res, next) => {
  try {
    const payload = validate(switchRoleSchema, req.body);
    const result = await authService.switchRole(req.user, payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const analytics = async (req, res, next) => {
  try {
    const payload = validate(analyticsSchema, req.query);
    const result = await authService.analyticsRegistrations(payload);
    res.json({ buckets: result });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  forgot,
  reset,
  verifyEmail,
  sendOtp,
  setup2fa,
  verify2fa,
  disable2fa,
  me,
  switchRole,
  analytics,
};
