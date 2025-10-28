const { User, Profile, Review } = require('../models');

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
  if (entity_type === 'review') {
    await Review.restore({ where: { id } });
  }
  return { success: true };
};

module.exports = { overview, listUsers, restore };
