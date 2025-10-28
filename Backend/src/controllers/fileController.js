const Joi = require('joi');
const service = require('../services/fileService');
const { persistIdempotentResponse } = require('../middleware/idempotency');

const createSchema = Joi.object({
  filename: Joi.string().max(255).required(),
  mime_type: Joi.string().max(255),
  size_bytes: Joi.number().integer().min(0),
  metadata: Joi.object(),
  checksum: Joi.string().max(128),
  storage_key: Joi.string().max(512),
}).required();

const analyticsSchema = Joi.object({
  owner_id: Joi.string().uuid(),
  from: Joi.date(),
  to: Joi.date(),
  includeDeleted: Joi.string().valid('true', 'false'),
});

const listSchema = Joi.object({
  cursor: Joi.string(),
  limit: Joi.number().integer().min(1).max(100),
  sort: Joi.string(),
  q: Joi.string().allow(''),
  fields: Joi.string(),
  include: Joi.string(),
  expand: Joi.string(),
  analytics: Joi.string(),
  owner_id: Joi.string().uuid(),
  status: Joi.string(),
  from: Joi.date(),
  to: Joi.date(),
});

const tokenSchema = Joi.object({ token: Joi.string().required() });

const create = async (req, res, next) => {
  try {
    const payload = await createSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const file = await service.registerFile(req.user, payload);
    await persistIdempotentResponse(req, res, { status: 201, body: { data: file } });
    res.status(201).json({ data: file });
  } catch (error) {
    next(error);
  }
};

const list = async (req, res, next) => {
  try {
    const payload = await listSchema.validateAsync(req.query, { abortEarly: false, stripUnknown: true });
    const result = await service.listFiles(payload, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const get = async (req, res, next) => {
  try {
    const redirect = await service.buildDownloadRedirect(req.params.id, req.user);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Location', redirect.location);
    res.setHeader('X-Download-Expires-At', redirect.expires_at);
    res.status(307).send();
  } catch (error) {
    next(error);
  }
};

const uploadContent = async (req, res, next) => {
  try {
    const { token } = await tokenSchema.validateAsync(req.query);
    const file = await service.storeFileContent({
      fileId: req.params.id,
      token,
      buffer: req.body,
      contentType: req.headers['content-type'],
    });
    res.status(200).json({ data: file });
  } catch (error) {
    next(error);
  }
};

const stream = async (req, res, next) => {
  try {
    const { token } = await tokenSchema.validateAsync(req.query);
    const { file, stats, stream } = await service.streamFile({ fileId: req.params.id, token });
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Last-Modified', stats.mtime.toUTCString());
    res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(file.filename || file.id)}`
    );
    stream.on('error', next);
    res.on('close', () => {
      if (!res.writableEnded) {
        stream.destroy();
      }
    });
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await service.deleteFile(req.params.id, req.user);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const analytics = async (req, res, next) => {
  try {
    const payload = await analyticsSchema.validateAsync(req.query, { abortEarly: false, stripUnknown: true });
    const result = await service.storageAnalytics(payload, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = { create, list, get, uploadContent, stream, remove, analytics };
