const { Op } = require('sequelize');
const { Notification, UserSetting } = require('../models');

const list = async (userId, query) => {
  const where = { user_id: userId };
  if (query.unread_only === 'true') where.read_at = null;
  const notifications = await Notification.findAll({ where, order: [['created_at', 'DESC']], limit: Number(query.limit || 50) });
  return notifications;
};

const markRead = async (userId, id) => {
  const notification = await Notification.findOne({ where: { id, user_id: userId } });
  if (!notification) return { success: true };
  notification.read_at = new Date();
  await notification.save();
  return notification;
};

const markAllRead = async (userId) => {
  await Notification.update({ read_at: new Date() }, { where: { user_id: userId, read_at: null } });
  return { success: true };
};

const getPreferences = async (userId) => {
  const [settings] = await UserSetting.findOrCreate({ where: { user_id: userId } });
  return settings.notifications || {};
};

const updatePreferences = async (userId, preferences) => {
  const [settings] = await UserSetting.findOrCreate({ where: { user_id: userId } });
  settings.notifications = preferences;
  await settings.save();
  return settings.notifications;
};

const deliveryAnalytics = async ({ from, to }) => {
  const where = {};
  if (from || to) {
    where.created_at = {};
    if (from) where.created_at[Op.gte] = new Date(from);
    if (to) where.created_at[Op.lte] = new Date(to);
  }

  const { sequelize } = Notification;

  const [delivered, opened, byChannel] = await Promise.all([
    Notification.count({ where }),
    Notification.count({
      where: {
        ...where,
        read_at: { [Op.ne]: null },
      },
    }),
    Notification.findAll({
      where,
      attributes: ['channel', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['channel'],
    }),
  ]);

  const channelBreakdown = byChannel.reduce((acc, row) => {
    const plain = row.get({ plain: true });
    acc[plain.channel || 'unknown'] = Number(plain.count) || 0;
    return acc;
  }, {});

  return { delivered, opened, channel_breakdown: channelBreakdown, from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined };
};

module.exports = { list, markRead, markAllRead, getPreferences, updatePreferences, deliveryAnalytics };
