const { User, UserSetting } = require('../models');

const getAccount = async (userId) => User.findByPk(userId);

const updateAccount = async (userId, payload) => {
  const user = await User.findByPk(userId);
  await user.update(payload);
  return user;
};

const getSettings = async (userId) => {
  const [settings] = await UserSetting.findOrCreate({ where: { user_id: userId } });
  return settings;
};

const updateSettingsSection = async (userId, key, value) => {
  const [settings] = await UserSetting.findOrCreate({ where: { user_id: userId } });
  settings[key] = value;
  await settings.save();
  return settings[key];
};

module.exports = {
  getAccount,
  updateAccount,
  getSettings,
  updateSettingsSection,
};
