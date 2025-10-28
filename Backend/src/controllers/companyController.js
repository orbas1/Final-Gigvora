const Joi = require('joi');
const service = require('../services/companyService');
const { ApiError } = require('../middleware/errorHandler');
const { persistIdempotentResponse } = require('../middleware/idempotency');

const createSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  description: Joi.string().allow('', null),
  website: Joi.string().uri(),
  industry: Joi.string(),
  size: Joi.string().valid('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'),
  headquarters: Joi.string(),
  logo_url: Joi.string().uri(),
  banner_url: Joi.string().uri(),
  metadata: Joi.object(),
  verified: Joi.boolean(),
  owner_id: Joi.string().uuid().optional(),
});

const updateSchema = createSchema.fork(['name'], (schema) => schema.optional());

const employeeSchema = Joi.object({
  user_id: Joi.string().uuid().required(),
  role: Joi.string().valid('member', 'admin').optional(),
  title: Joi.string().max(255).allow('', null),
  invited_at: Joi.date().optional(),
  joined_at: Joi.date().optional(),
});

const validate = (schema, payload) => {
  const { value, error } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', { errors: error.details });
  }
  return value;
};

const list = async (req, res, next) => {
  try {
    const companies = await service.list(req.query, req.user);
    res.json(companies);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const payload = validate(createSchema, req.body);
    const company = await service.create(payload, req.user);
    await persistIdempotentResponse(req, res, { status: 201, body: company });
    res.status(201).json(company);
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const company = await service.getById(req.params.id, req.query, req.user);
    res.json(company);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const payload = validate(updateSchema, req.body);
    const company = await service.update(req.params.id, payload, req.user);
    res.json(company);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await service.remove(req.params.id, req.user);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const listEmployees = async (req, res, next) => {
  try {
    const employees = await service.listMembers(req.params.id, req.query, req.user);
    res.json(employees);
  } catch (error) {
    next(error);
  }
};

const addEmployee = async (req, res, next) => {
  try {
    const payload = validate(employeeSchema, req.body);
    const member = await service.addMember(req.params.id, payload, req.user);
    const response = member.toJSON ? member.toJSON() : member;
    await persistIdempotentResponse(req, res, { status: 201, body: response });
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

const removeEmployee = async (req, res, next) => {
  try {
    await service.removeMember(req.params.id, req.params.userId, req.user);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const analytics = async (req, res, next) => {
  try {
    const data = await service.analyticsProfile(req.params.id, req.query, req.user);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  list,
  create,
  getById,
  update,
  remove,
  listEmployees,
  addEmployee,
  removeEmployee,
  analytics,
};
