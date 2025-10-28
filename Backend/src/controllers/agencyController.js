const Joi = require('joi');
const service = require('../services/agencyService');
const { ApiError } = require('../middleware/errorHandler');
const { persistIdempotentResponse } = require('../middleware/idempotency');

const flexibleListSchema = Joi.alternatives()
  .try(
    Joi.array().items(Joi.alternatives(Joi.string(), Joi.number(), Joi.boolean())),
    Joi.object().pattern(/.*/, Joi.alternatives(Joi.string(), Joi.number(), Joi.array(), Joi.boolean())),
    Joi.string().allow('', null)
  )
  .allow(null);

const normalizeList = (value) => {
  if (value === undefined) return value;
  if (value === null) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => (item === null || item === undefined ? '' : String(item)))
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === 'object') {
    return Object.values(value)
      .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
      .map((entry) => (entry === null || entry === undefined ? '' : String(entry)))
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [String(value).trim()].filter(Boolean);
};

const createSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  description: Joi.string().allow('', null),
  website: Joi.string().uri(),
  services: flexibleListSchema,
  specialties: flexibleListSchema,
  location: Joi.string(),
  logo_url: Joi.string().uri(),
  banner_url: Joi.string().uri(),
  metadata: Joi.object(),
  verified: Joi.boolean(),
  owner_id: Joi.string().uuid().optional(),
});

const updateSchema = createSchema.fork(['name'], (schema) => schema.optional());

const memberSchema = Joi.object({
  user_id: Joi.string().uuid().required(),
  role: Joi.string().valid('member', 'lead', 'admin').optional(),
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
    const agencies = await service.list(req.query, req.user);
    res.json(agencies);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const payload = validate(createSchema, req.body);
    const services = normalizeList(payload.services);
    const specialties = normalizeList(payload.specialties);
    if (services !== undefined) payload.services = services;
    if (specialties !== undefined) payload.specialties = specialties;
    const agency = await service.create(payload, req.user);
    await persistIdempotentResponse(req, res, { status: 201, body: agency });
    res.status(201).json(agency);
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const agency = await service.getById(req.params.id, req.query, req.user);
    res.json(agency);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const payload = validate(updateSchema, req.body);
    const services = normalizeList(payload.services);
    const specialties = normalizeList(payload.specialties);
    if (services !== undefined) payload.services = services;
    if (specialties !== undefined) payload.specialties = specialties;
    const agency = await service.update(req.params.id, payload, req.user);
    res.json(agency);
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

const listTeam = async (req, res, next) => {
  try {
    const team = await service.listMembers(req.params.id, req.query, req.user);
    res.json(team);
  } catch (error) {
    next(error);
  }
};

const addTeamMember = async (req, res, next) => {
  try {
    const payload = validate(memberSchema, req.body);
    const member = await service.addMember(req.params.id, payload, req.user);
    const response = member.toJSON ? member.toJSON() : member;
    await persistIdempotentResponse(req, res, { status: 201, body: response });
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

const removeTeamMember = async (req, res, next) => {
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
  listTeam,
  addTeamMember,
  removeTeamMember,
  analytics,
};
