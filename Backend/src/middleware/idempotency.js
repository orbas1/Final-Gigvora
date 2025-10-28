const crypto = require('crypto');
const { IdempotencyKey } = require('../models');
const { ApiError } = require('./errorHandler');

const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

const cloneBody = (body) => {
  if (body === undefined) return undefined;
  if (body === null) return null;
  if (Buffer.isBuffer(body)) {
    return body.toString('base64');
  }
  if (typeof body === 'object') {
    try {
      return JSON.parse(JSON.stringify(body));
    } catch (error) {
      return body;
    }
  }
  return body;
};

const schedulePersistence = (req, res) => {
  if (!res.locals.idempotencyKey) return;

  const persist = async () => {
    const response = res.locals.idempotencyResponse;
    if (!response) {
      return;
    }

    const { key, hash } = res.locals.idempotencyKey;
    try {
      await IdempotencyKey.upsert({
        key,
        user_id: req.user?.id || null,
        method: req.method,
        path: req.originalUrl,
        request_hash: hash,
        response_body: response.body,
        response_status: response.status,
      });
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Failed to persist idempotency response', error);
      }
    }
  };

  res.once('finish', persist);
};

const wrapResponseWriters = (res) => {
  const capture = (body) => {
    res.locals.idempotencyResponse = { status: res.statusCode, body: cloneBody(body) };
    return body;
  };

  const originalJson = res.json.bind(res);
  res.json = (body) => originalJson(capture(body));

  const originalSend = res.send.bind(res);
  res.send = (body) => originalSend(capture(body));

  const originalEnd = res.end.bind(res);
  res.end = function end(...args) {
    if (!res.locals.idempotencyResponse) {
      res.locals.idempotencyResponse = { status: res.statusCode, body: null };
    }
    return originalEnd.apply(this, args);
  };
};

const idempotencyMiddleware = async (req, res, next) => {
  if (!MUTATING_METHODS.includes(req.method)) {
    return next();
  }

  const key = req.headers['idempotency-key'];
  if (!key) {
    return next();
  }

  try {
    const hash = crypto.createHash('sha256').update(JSON.stringify(req.body || {})).digest('hex');
    const existing = await IdempotencyKey.findOne({ where: { key } });

    if (existing) {
      if (existing.request_hash !== hash || existing.method !== req.method || existing.path !== req.originalUrl) {
        throw new ApiError(409, 'Idempotency key conflict', 'IDEMPOTENCY_KEY_CONFLICT');
      }

      res.setHeader('X-Idempotent-Replay', 'true');
      return res.status(existing.response_status || 200).json(existing.response_body || {});
    }

    res.locals.idempotencyKey = { key, hash };
    wrapResponseWriters(res);
    schedulePersistence(req, res);
    return next();
  } catch (error) {
    return next(error);
  }
};

const persistIdempotentResponse = (req, res, payload) => {
  if (!res.locals.idempotencyKey || !payload) return;
  res.locals.idempotencyResponse = {
    status: payload.status,
    body: cloneBody(payload.body),
  };
};

module.exports = { idempotencyMiddleware, persistIdempotentResponse };
