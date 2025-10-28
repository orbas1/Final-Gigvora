const Joi = require('joi');
const service = require('../services/webhookService');

const createSchema = Joi.object({ name: Joi.string().required(), url: Joi.string().uri().required(), events: Joi.array().items(Joi.string()).default([]) });

const list = async (req, res, next) => {
  try {
    const subs = await service.list();
    res.json({ data: subs });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const payload = await createSchema.validateAsync(req.body);
    const sub = await service.create(payload);
    res.status(201).json(sub);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await service.remove(req.params.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

const deliveries = async (req, res, next) => {
  try {
    const result = await service.deliveries(req.query);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

module.exports = { list, create, remove, deliveries };
