const Joi = require('joi');
const walletService = require('../services/walletService');
const { ApiError } = require('../middleware/errorHandler');

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', { errors: error.details });
  return value;
};

const methodQuerySchema = Joi.object({
  cursor: Joi.string().optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  sort: Joi.string().optional(),
  q: Joi.string().optional(),
  analytics: Joi.string().valid('true', 'false').optional(),
  include: Joi.string().optional(),
});

const methodBodySchema = Joi.object({
  type: Joi.string().valid('card', 'bank_account', 'wallet', 'upi', 'other').required(),
  label: Joi.string().allow('', null),
  brand: Joi.string().allow('', null),
  last4: Joi.string().pattern(/^[0-9A-Za-z]{2,6}$/).allow(null),
  exp_month: Joi.number().integer().min(1).max(12).allow(null),
  exp_year: Joi.number().integer().min(new Date().getFullYear()).allow(null),
  country: Joi.string().length(2).allow(null),
  fingerprint: Joi.string().allow(null),
  is_default: Joi.boolean().optional(),
  status: Joi.string().valid('active', 'inactive', 'blocked').optional(),
  metadata: Joi.object().optional(),
});

const methodUpdateSchema = methodBodySchema
  .fork(['type', 'fingerprint'], (schema) => schema.optional())
  .min(1);

const payoutQuerySchema = Joi.object({
  cursor: Joi.string().optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  sort: Joi.string().optional(),
  analytics: Joi.string().valid('true', 'false').optional(),
  include: Joi.string().optional(),
});

const payoutBodySchema = Joi.object({
  type: Joi.string().valid('bank_account', 'mobile_money', 'crypto', 'other').required(),
  account_holder_name: Joi.string().required(),
  account_identifier_last4: Joi.string().allow(null),
  bank_name: Joi.string().allow(null),
  routing_number: Joi.string().allow(null),
  currency: Joi.string().length(3).required(),
  country: Joi.string().length(2).allow(null),
  status: Joi.string().valid('verified', 'pending', 'blocked').optional(),
  external_account_id: Joi.string().allow(null),
  verified_at: Joi.date().optional(),
  metadata: Joi.object().optional(),
});

const payoutUpdateSchema = payoutBodySchema.fork(['type'], (schema) => schema.optional()).min(1);

const getWallet = async (req, res, next) => {
  try {
    const result = await walletService.getBalances(req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const listMethods = async (req, res, next) => {
  try {
    const query = validate(methodQuerySchema, req.query);
    const wallet = await walletService.ensureWallet(req.user.id);
    const includeDeleted = query.include === 'deleted' && req.user.role === 'admin';
    const result = await walletService.listPaymentMethods(wallet.id, query, { includeDeleted });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const createMethod = async (req, res, next) => {
  try {
    const body = validate(methodBodySchema, req.body);
    const wallet = await walletService.ensureWallet(req.user.id);
    const result = await walletService.createPaymentMethod(wallet.id, body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const deleteMethod = async (req, res, next) => {
  try {
    const wallet = await walletService.ensureWallet(req.user.id);
    const result = await walletService.deletePaymentMethod(wallet.id, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getMethod = async (req, res, next) => {
  try {
    const wallet = await walletService.ensureWallet(req.user.id);
    const includeDeleted = req.query.include === 'deleted' && req.user.role === 'admin';
    const result = await walletService.getPaymentMethod(wallet.id, req.params.id, { includeDeleted });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const updateMethod = async (req, res, next) => {
  try {
    const body = validate(methodUpdateSchema, req.body);
    const wallet = await walletService.ensureWallet(req.user.id);
    const result = await walletService.updatePaymentMethod(wallet.id, req.params.id, body, {
      allowManageDeleted: req.user.role === 'admin',
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const listPayoutAccounts = async (req, res, next) => {
  try {
    const query = validate(payoutQuerySchema, req.query);
    const wallet = await walletService.ensureWallet(req.user.id);
    const includeDeleted = query.include === 'deleted' && req.user.role === 'admin';
    const result = await walletService.listPayoutAccounts(wallet.id, query, { includeDeleted });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const createPayoutAccount = async (req, res, next) => {
  try {
    const body = validate(payoutBodySchema, req.body);
    const wallet = await walletService.ensureWallet(req.user.id);
    const result = await walletService.createPayoutAccount(wallet.id, body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const deletePayoutAccount = async (req, res, next) => {
  try {
    const wallet = await walletService.ensureWallet(req.user.id);
    const result = await walletService.deletePayoutAccount(wallet.id, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getPayoutAccount = async (req, res, next) => {
  try {
    const wallet = await walletService.ensureWallet(req.user.id);
    const includeDeleted = req.query.include === 'deleted' && req.user.role === 'admin';
    const result = await walletService.getPayoutAccount(wallet.id, req.params.id, { includeDeleted });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const updatePayoutAccount = async (req, res, next) => {
  try {
    const body = validate(payoutUpdateSchema, req.body);
    const wallet = await walletService.ensureWallet(req.user.id);
    const result = await walletService.updatePayoutAccount(wallet.id, req.params.id, body, {
      allowManageDeleted: req.user.role === 'admin',
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getWallet,
  listMethods,
  createMethod,
  getMethod,
  updateMethod,
  deleteMethod,
  listPayoutAccounts,
  createPayoutAccount,
  getPayoutAccount,
  updatePayoutAccount,
  deletePayoutAccount,
};
