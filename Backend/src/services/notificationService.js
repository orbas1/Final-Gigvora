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
  return settings.preferences || {};
};

const updatePreferences = async (userId, preferences) => {
  const [settings] = await UserSetting.findOrCreate({ where: { user_id: userId } });
  settings.preferences = preferences;
  await settings.save();
  return settings.preferences;
};

const deliveryAnalytics = async ({ from, to }) => {
  return { delivered: 0, opened: 0, from, to };
};

module.exports = { list, markRead, markAllRead, getPreferences, updatePreferences, deliveryAnalytics };
