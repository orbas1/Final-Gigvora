const crypto = require('crypto');
const { IdempotencyKey } = require('../models');

const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

const idempotencyMiddleware = (req, res, next) => {
  if (!MUTATING_METHODS.includes(req.method)) {
    return next();
  }

  const key = req.headers['idempotency-key'];
  if (!key) {
    return next();
  }

  const hash = crypto.createHash('sha256').update(JSON.stringify(req.body || {})).digest('hex');

  IdempotencyKey.findOne({ where: { key } })
    .then((existing) => {
      if (!existing) {
        req.idempotency = { key, hash };
        return next();
      }

      if (existing.request_hash !== hash || existing.method !== req.method || existing.path !== req.originalUrl) {
        return next(new (require('./errorHandler').ApiError)(409, 'Idempotency key conflict', 'IDEMPOTENCY_KEY_CONFLICT'));
      }

      res.status(existing.response_status || 200).json(existing.response_body || {});
    })
    .catch(next);
};

const persistIdempotentResponse = async (req, res, payload) => {
  if (!req.idempotency) return;
  const { key, hash } = req.idempotency;
  await IdempotencyKey.upsert({
    key,
    user_id: req.user?.id,
    method: req.method,
    path: req.originalUrl,
    request_hash: hash,
    response_body: payload.body,
    response_status: payload.status,
  });
};

module.exports = { idempotencyMiddleware, persistIdempotentResponse };
