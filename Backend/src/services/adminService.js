const { User, Profile, Conversation, Message, sequelize } = require('../models');

const overview = async ({ from, to }) => {
  const totalUsers = await User.count();
  return { totalUsers, from, to };
};

const listUsers = async () => User.findAll({ limit: 100 });

const restore = async ({ entity_type, id }) => {
  if (entity_type === 'user') {
    await User.restore({ where: { id } });
  }
  if (entity_type === 'profile') {
    await Profile.restore({ where: { id } });
  }
  if (entity_type === 'conversation') {
    await Conversation.restore({ where: { id } });
  }
  if (entity_type === 'message') {
    await Message.restore({ where: { id } });
  }
  return { success: true };
};

module.exports = { overview, listUsers, restore };
