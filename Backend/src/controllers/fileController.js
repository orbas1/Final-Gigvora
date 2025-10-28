const Joi = require('joi');
const service = require('../services/fileService');

const createSchema = Joi.object({ filename: Joi.string().required(), mime_type: Joi.string(), size_bytes: Joi.number(), metadata: Joi.object(), storage_key: Joi.string() });

const create = async (req, res, next) => {
  try {
    const payload = await createSchema.validateAsync(req.body);
    const file = await service.createFile(req.user.id, payload);
    res.status(201).json(file);
  } catch (error) {
    next(error);
  }
};

const get = async (req, res, next) => {
  try {
    const file = await service.getFile(req.params.id);
    if (!file) return res.status(404).json({ message: 'Not found' });
    res.json(file);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await service.deleteFile(req.params.id, req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const analytics = async (req, res, next) => {
  try {
    const result = await service.storageAnalytics({ owner_id: req.user.id, ...req.query });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = { create, get, remove, analytics };
