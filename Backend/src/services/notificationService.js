const { Op, fn, col } = require('sequelize');
const merge = require('lodash/merge');
const dayjs = require('dayjs');
const { Notification, UserSetting } = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { buildPagination, encodeCursor } = require('../utils/pagination');

const parseListParam = (value) => {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const DEFAULT_PREFERENCES = {
  channels: {
    email: { enabled: true, marketing: false, transactional: true },
    push: { enabled: true },
    sms: { enabled: false },
  },
  digest: { frequency: 'immediate' },
};

const list = async (user, query) => {
  const pagination = buildPagination(query, ['created_at', 'updated_at']);
  const includes = new Set(parseListParam(query.include));
  const selectableFields = ['id', 'type', 'data', 'read_at', 'channel', 'created_at', 'updated_at', 'deleted_at'];
  const fields = parseListParam(query.fields).filter((field) => selectableFields.includes(field));
  const paranoid = !(includes.has('deleted') && user.role === 'admin');

  const baseWhere = { user_id: user.id };
  if (query.unread_only === 'true') {
    baseWhere.read_at = null;
  }
  if (query.q) {
    const term = `%${String(query.q).toLowerCase()}%`;
    baseWhere[Op.or] = [
      Notification.sequelize.where(fn('lower', col('Notification.type')), { [Op.like]: term }),
      Notification.sequelize.where(fn('lower', col('Notification.channel')), { [Op.like]: term }),
      Notification.sequelize.where(
        fn(
          'lower',
          Notification.sequelize.cast(col('Notification.data'), Notification.sequelize.getDialect() === 'mysql' ? 'CHAR' : 'TEXT')
        ),
        { [Op.like]: term }
      ),
    ];
  }

  const where = { ...baseWhere };
  if (pagination.cursorValue !== undefined) {
    where[pagination.sortField] = {
      [pagination.cursorOperator]: pagination.cursorValue,
    };
  }

  const attributes = fields.length
    ? Array.from(new Set([...fields, 'id', pagination.sortField])).filter(Boolean)
    : undefined;

  const rows = await Notification.findAll({
    where,
    attributes,
    paranoid,
    order: pagination.order,
    limit: pagination.limit + 1,
  });

  const hasMore = rows.length > pagination.limit;
  const sliced = hasMore ? rows.slice(0, pagination.limit) : rows;
  const data = sliced.map((row) => row.toJSON());
  const nextCursorValue = hasMore ? sliced[sliced.length - 1]?.[pagination.sortField] : undefined;

  const total = await Notification.count({ where: baseWhere, paranoid });

  let analytics;
  if (query.analytics === 'true') {
    const [unread, channels] = await Promise.all([
      Notification.count({ where: { ...baseWhere, read_at: null }, paranoid }),
      Notification.findAll({
        attributes: ['channel', [fn('COUNT', col('*')), 'count']],
        where: baseWhere,
        paranoid,
        group: ['channel'],
      }),
    ]);
    analytics = {
      total,
      unread,
      by_channel: channels.reduce(
        (acc, row) => ({
          ...acc,
          [row.channel || 'unknown']: Number(row.get('count')) || 0,
        }),
        {}
      ),
    };
  }

  return {
    data,
    total,
    page: {
      next_cursor: hasMore ? encodeCursor(nextCursorValue) : null,
      limit: pagination.limit,
    },
    analytics,
  };
};

const markRead = async (userId, id) => {
  const notification = await Notification.findOne({ where: { id, user_id: userId }, paranoid: false });
  if (!notification) {
    throw new ApiError(404, 'Notification not found', 'NOTIFICATION_NOT_FOUND');
  }
  if (notification.deleted_at) {
    throw new ApiError(404, 'Notification not found', 'NOTIFICATION_NOT_FOUND');
  }
  notification.read_at = notification.read_at || new Date();
  await notification.save();
  return notification.toJSON();
};

const markAllRead = async (userId, { before } = {}) => {
  const where = { user_id: userId, read_at: null };
  if (before) {
    where.created_at = { [Op.lte]: dayjs(before).toDate() };
  }
  const [updated] = await Notification.update({ read_at: new Date() }, { where });
  return { updated: Number(updated) || 0 };
};

const loadPreferences = async (userId) => {
  const [settings] = await UserSetting.findOrCreate({
    where: { user_id: userId },
    defaults: { preferences: DEFAULT_PREFERENCES },
  });
  return settings;
};

const getPreferences = async (userId) => {
  const settings = await loadPreferences(userId);
  return merge({}, DEFAULT_PREFERENCES, settings.preferences || {});
};

const updatePreferences = async (userId, preferences) => {
  const settings = await loadPreferences(userId);
  const merged = merge({}, DEFAULT_PREFERENCES, settings.preferences || {}, preferences || {});
  settings.preferences = merged;
  await settings.save();
  return merged;
};

const deliveryAnalytics = async ({ from, to }) => {
  const where = {};
  if (from || to) {
    where.created_at = {};
    if (from) where.created_at[Op.gte] = dayjs(from).toDate();
    if (to) where.created_at[Op.lte] = dayjs(to).toDate();
  }

  const [delivered, opened, byChannel, timeline] = await Promise.all([
    Notification.count({ where }),
    Notification.count({ where: { ...where, read_at: { [Op.ne]: null } } }),
    Notification.findAll({
      attributes: ['channel', [fn('COUNT', col('*')), 'count']],
      where,
      group: ['channel'],
    }),
    Notification.findAll({
      attributes: [
        [fn('date', col('created_at')), 'bucket'],
        [fn('COUNT', col('*')), 'delivered'],
        [fn('COUNT', col('read_at')), 'opened'],
      ],
      where,
      group: [fn('date', col('created_at'))],
      order: [[fn('date', col('created_at')), 'ASC']],
    }),
  ]);

  return {
    delivered,
    opened,
    by_channel: byChannel.reduce(
      (acc, row) => ({
        ...acc,
        [row.channel || 'unknown']: Number(row.get('count')) || 0,
      }),
      {}
    ),
    timeline: timeline.map((row) => ({
      date: row.get('bucket'),
      delivered: Number(row.get('delivered')) || 0,
      opened: Number(row.get('opened')) || 0,
    })),
    range: {
      from: from ? dayjs(from).toISOString() : null,
      to: to ? dayjs(to).toISOString() : null,
    },
  };
};

module.exports = { list, markRead, markAllRead, getPreferences, updatePreferences, deliveryAnalytics };
