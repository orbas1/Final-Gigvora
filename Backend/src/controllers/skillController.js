const Joi = require('joi');
const service = require('../services/skillService');

const listSchema = Joi.object({
  cursor: Joi.string(),
  limit: Joi.number().integer().min(1).max(100),
  sort: Joi.string(),
  q: Joi.string().allow(''),
  fields: Joi.string(),
  include: Joi.string(),
  expand: Joi.string(),
  analytics: Joi.string(),
});

const createSchema = Joi.object({
  name: Joi.string().min(2).max(120).required(),
  description: Joi.string().allow('', null),
});

const updateSchema = Joi.object({
  name: Joi.string().min(2).max(120),
  description: Joi.string().allow('', null),
}).min(1);

const suggestSchema = Joi.object({
  q: Joi.string().allow(''),
  limit: Joi.number().integer().min(1).max(25).default(10),
});

const list = async (req, res, next) => {
  try {
    const payload = await listSchema.validateAsync(req.query, { abortEarly: false, stripUnknown: true });
    const result = await service.list(payload, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const payload = await createSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const skill = await service.create(payload);
    res.status(201).json({ data: skill });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const payload = await updateSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const skill = await service.update(req.params.id, payload);
    res.json({ data: skill });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await service.remove(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const suggest = async (req, res, next) => {
  try {
    const payload = await suggestSchema.validateAsync(req.query, { abortEarly: false, stripUnknown: true });
    const results = await service.suggest(payload);
    res.json({ data: results });
  } catch (error) {
    next(error);
  }
};

module.exports = { list, create, update, remove, suggest };
