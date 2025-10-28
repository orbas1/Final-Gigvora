const crypto = require('crypto');
const dayjs = require('dayjs');
const { Op } = require('sequelize');
const { WebhookSubscription, WebhookDelivery, sequelize } = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { buildPagination, encodeCursor } = require('../utils/pagination');
const { persistIdempotentResponse } = require('../middleware/idempotency');

const BOOLEAN_TRUE = new Set(['true', '1', 'yes']);

const toBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (BOOLEAN_TRUE.has(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
  }
  return false;
};

const normalizeEvents = (events = []) => {
  if (!Array.isArray(events)) {
    return [];
  }
  const seen = new Set();
  const normalized = [];
  events
    .map((event) => String(event || '').trim().toLowerCase())
    .filter(Boolean)
    .forEach((event) => {
      if (!seen.has(event)) {
        seen.add(event);
        normalized.push(event);
      }
    });
  return normalized;
};

const searchCondition = (value) => {
  if (!value) return undefined;
  const pattern = `%${value}%`;
  const likeOperator = sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like;
  return {
    [Op.or]: [{ name: { [likeOperator]: pattern } }, { url: { [likeOperator]: pattern } }],
  };
};

const sanitizeSubscription = (subscription) => {
  const json = subscription.toJSON();
  delete json.signing_secret_hash;
  return json;
};

const applyCursorCondition = (where, pagination) => {
  if (pagination.cursorValue === undefined || pagination.cursorValue === null) {
    return where;
  }
  const current = where[pagination.sortField];
  if (current && typeof current === 'object' && !Array.isArray(current)) {
    where[pagination.sortField] = { ...current, [pagination.cursorOperator]: pagination.cursorValue };
  } else {
    where[pagination.sortField] = { [pagination.cursorOperator]: pagination.cursorValue };
  }
  return where;
};

const loadSubscription = async (user, id, { includeDeleted = false } = {}) => {
  if (!user) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }
  const subscription = await WebhookSubscription.findByPk(id, { paranoid: !includeDeleted });
  if (!subscription || (user.role !== 'admin' && subscription.owner_id !== user.id)) {
    throw new ApiError(404, 'Webhook subscription not found', 'WEBHOOK_SUBSCRIPTION_NOT_FOUND');
  }
  return subscription;
};

const list = async (user, query = {}) => {
  if (!user) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  const pagination = buildPagination(query, ['created_at', 'name']);
  const baseWhere = {};

  if (user.role === 'admin' && query.owner_id) {
    baseWhere.owner_id = query.owner_id;
  } else {
    baseWhere.owner_id = user.id;
  }

  if (query.status) {
    baseWhere.status = query.status;
  }
  const search = searchCondition(query.q);
  if (search) {
    Object.assign(baseWhere, search);
  }

  const paranoid = !(query.include === 'deleted' && user.role === 'admin');
  const pageWhere = { ...baseWhere };
  applyCursorCondition(pageWhere, pagination);

  const records = await WebhookSubscription.findAll({
    where: pageWhere,
    order: pagination.order,
    limit: pagination.limit + 1,
    paranoid,
  });

  const hasNext = records.length > pagination.limit;
  const sliced = hasNext ? records.slice(0, -1) : records;
  const lastRecord = sliced[sliced.length - 1];
  const nextCursor = lastRecord ? encodeCursor(lastRecord.get(pagination.sortField)) : null;

  let analyticsPayload;
  if (toBoolean(query.analytics)) {
    const analyticsWhere = { ...baseWhere };
    const [total, active, paused, disabled] = await Promise.all([
      WebhookSubscription.count({ where: analyticsWhere, paranoid }),
      WebhookSubscription.count({ where: { ...analyticsWhere, status: 'active' }, paranoid }),
      WebhookSubscription.count({ where: { ...analyticsWhere, status: 'paused' }, paranoid }),
      WebhookSubscription.count({ where: { ...analyticsWhere, status: 'disabled' }, paranoid }),
    ]);
    analyticsPayload = {
      total_subscriptions: total,
      active,
      paused,
      disabled,
    };
  }

  return {
    data: sliced.map(sanitizeSubscription),
    next_cursor: hasNext ? nextCursor : null,
    analytics: analyticsPayload,
  };
};

const create = async (req, res, user, payload) => {
  if (!user) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }
  const events = normalizeEvents(payload.events);
  if (!events.length) {
    throw new ApiError(400, 'At least one event must be specified for a webhook subscription', 'INVALID_PAYLOAD');
  }

  const signingSecret = crypto.randomBytes(32).toString('hex');
  const signingSecretHash = crypto.createHash('sha256').update(signingSecret).digest('hex');

  const subscription = await WebhookSubscription.create({
    owner_id: user.role === 'admin' && payload.owner_id ? payload.owner_id : user.id,
    name: payload.name,
    url: payload.url,
    events,
    status: payload.status || 'active',
    signing_secret_hash: signingSecretHash,
    signing_secret_last4: signingSecret.slice(-4),
  });

  const response = {
    ...sanitizeSubscription(subscription),
    signing_secret: signingSecret,
  };
  await persistIdempotentResponse(req, res, { status: 201, body: response });
  return response;
};

const get = async (user, id, query = {}) => {
  const includeDeleted = query.include === 'deleted' && user?.role === 'admin';
  const subscription = await loadSubscription(user, id, { includeDeleted });
  return sanitizeSubscription(subscription);
};

const update = async (user, id, payload) => {
  const subscription = await loadSubscription(user, id, { includeDeleted: true });
  if (subscription.deleted_at) {
    throw new ApiError(409, 'Cannot update a deleted webhook subscription', 'WEBHOOK_SUBSCRIPTION_DELETED');
  }

  if (payload.events) {
    const events = normalizeEvents(payload.events);
    if (!events.length) {
      throw new ApiError(400, 'At least one event must be specified for a webhook subscription', 'INVALID_PAYLOAD');
    }
    subscription.events = events;
  }
  if (payload.name) {
    subscription.name = payload.name;
  }
  if (payload.url) {
    subscription.url = payload.url;
  }
  if (payload.status) {
    subscription.status = payload.status;
  }
  if (payload.owner_id && user.role === 'admin') {
    subscription.owner_id = payload.owner_id;
  }
  if (payload.reset_delivery_metrics) {
    subscription.delivery_attempts = 0;
    subscription.last_delivery_at = null;
    subscription.last_failure_at = null;
  }

  await subscription.save();
  return sanitizeSubscription(subscription);
};

const remove = async (user, id) => {
  const subscription = await loadSubscription(user, id, { includeDeleted: true });
  if (subscription.deleted_at) {
    return { success: true };
  }
  subscription.status = 'disabled';
  await subscription.save();
  await subscription.destroy();
  return { success: true };
};

const computeDeliveryAnalytics = async (where, paranoid) => {
  const baseOptions = { where, paranoid };
  const [total, successful, failed, pending, avgDurationRow] = await Promise.all([
    WebhookDelivery.count(baseOptions),
    WebhookDelivery.count({ ...baseOptions, where: { ...where, status: 'success' } }),
    WebhookDelivery.count({ ...baseOptions, where: { ...where, status: 'failed' } }),
    WebhookDelivery.count({ ...baseOptions, where: { ...where, status: 'pending' } }),
    WebhookDelivery.findOne({
      attributes: [[sequelize.fn('AVG', sequelize.col('duration_ms')), 'avg_duration']],
      where,
      paranoid,
      raw: true,
    }),
  ]);

  return {
    total_deliveries: total,
    success: successful,
    failed,
    pending,
    average_duration_ms: avgDurationRow?.avg_duration ? Number(avgDurationRow.avg_duration) : null,
  };
};

const deliveries = async (user, query = {}) => {
  if (!user) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  const isAdmin = user.role === 'admin';
  const pagination = buildPagination(query, ['attempted_at', 'created_at']);
  const baseWhere = {};

  if (query.status) {
    baseWhere.status = query.status;
  }
  if (query.from || query.to) {
    baseWhere.attempted_at = baseWhere.attempted_at || {};
    if (query.from) {
      const fromDate = dayjs(query.from);
      if (!fromDate.isValid()) {
        throw new ApiError(400, 'Invalid from date provided', 'INVALID_QUERY');
      }
      baseWhere.attempted_at[Op.gte] = fromDate.toDate();
    }
    if (query.to) {
      const toDate = dayjs(query.to);
      if (!toDate.isValid()) {
        throw new ApiError(400, 'Invalid to date provided', 'INVALID_QUERY');
      }
      baseWhere.attempted_at[Op.lte] = toDate.toDate();
    }
  }
  if (query.subscription_id) {
    const subscription = await loadSubscription(user, query.subscription_id, { includeDeleted: true });
    if (isAdmin && query.owner_id && subscription.owner_id !== query.owner_id) {
      throw new ApiError(404, 'Webhook subscription not found for requested owner', 'WEBHOOK_SUBSCRIPTION_NOT_FOUND');
    }
    baseWhere.subscription_id = subscription.id;
  }

  const subscriptionWhere = {};
  if (!isAdmin) {
    subscriptionWhere.owner_id = user.id;
  } else if (query.owner_id) {
    subscriptionWhere.owner_id = query.owner_id;
  }

  if (!baseWhere.subscription_id && Object.keys(subscriptionWhere).length) {
    const subscriptions = await WebhookSubscription.findAll({
      where: subscriptionWhere,
      attributes: ['id'],
      paranoid: false,
    });
    if (!subscriptions.length) {
      const analyticsPayload = toBoolean(query.analytics)
        ? {
            total_deliveries: 0,
            success: 0,
            failed: 0,
            pending: 0,
            average_duration_ms: null,
          }
        : undefined;
      return { data: [], next_cursor: null, analytics: analyticsPayload };
    }
    baseWhere.subscription_id = { [Op.in]: subscriptions.map((record) => record.id) };
  }

  const paranoid = !(query.include === 'deleted' && isAdmin);

  const subscriptionInclude = {
    model: WebhookSubscription,
    as: 'subscription',
    attributes: ['id', 'name', 'url', 'status', 'owner_id', 'signing_secret_last4', 'last_delivery_at', 'last_failure_at'],
    paranoid: false,
    required: true,
  };
  if (Object.keys(subscriptionWhere).length) {
    subscriptionInclude.where = subscriptionWhere;
  }

  const pageWhere = { ...baseWhere };
  applyCursorCondition(pageWhere, pagination);

  const records = await WebhookDelivery.findAll({
    where: pageWhere,
    include: [subscriptionInclude],
    order: pagination.order,
    limit: pagination.limit + 1,
    paranoid,
  });

  const hasNext = records.length > pagination.limit;
  const sliced = hasNext ? records.slice(0, -1) : records;
  const lastRecord = sliced[sliced.length - 1];
  const nextCursor = lastRecord ? encodeCursor(lastRecord.get(pagination.sortField)) : null;

  let analyticsPayload;
  if (toBoolean(query.analytics)) {
    analyticsPayload = await computeDeliveryAnalytics(baseWhere, paranoid);
  }

  return {
    data: sliced.map((record) => record.toJSON()),
    next_cursor: hasNext ? nextCursor : null,
    analytics: analyticsPayload,
  };
};

const recordDelivery = async ({ subscriptionId, event, payload, status, responseStatus, responseBody, errorMessage, durationMs }) => {
  const subscription = await WebhookSubscription.findByPk(subscriptionId, { paranoid: false });
  if (!subscription) {
    throw new ApiError(404, 'Webhook subscription not found', 'WEBHOOK_SUBSCRIPTION_NOT_FOUND');
  }

  const delivery = await WebhookDelivery.create({
    subscription_id: subscriptionId,
    event,
    payload,
    status: status || 'pending',
    response_status: responseStatus,
    response_body: responseBody,
    error_message: errorMessage,
    duration_ms: durationMs,
    completed_at: status === 'success' || status === 'failed' ? dayjs().toDate() : null,
  });

  subscription.delivery_attempts += 1;
  if (delivery.status === 'success') {
    subscription.last_delivery_at = delivery.completed_at || new Date();
  }
  if (delivery.status === 'failed') {
    subscription.last_failure_at = delivery.completed_at || new Date();
  }
  await subscription.save();
  return delivery.toJSON();
};

const rotateSecret = async (req, res, user, id) => {
  const subscription = await loadSubscription(user, id, { includeDeleted: true });
  if (subscription.deleted_at) {
    throw new ApiError(409, 'Cannot rotate secret for a deleted subscription', 'WEBHOOK_SUBSCRIPTION_DELETED');
  }

  const signingSecret = crypto.randomBytes(32).toString('hex');
  const signingSecretHash = crypto.createHash('sha256').update(signingSecret).digest('hex');
  subscription.signing_secret_hash = signingSecretHash;
  subscription.signing_secret_last4 = signingSecret.slice(-4);
  await subscription.save();

  const response = {
    ...sanitizeSubscription(subscription),
    signing_secret: signingSecret,
  };
  await persistIdempotentResponse(req, res, { status: 200, body: response });
  return response;
};

module.exports = { list, create, get, update, remove, deliveries, recordDelivery, rotateSecret };
