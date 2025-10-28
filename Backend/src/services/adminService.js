const { User, Profile, Post, Comment, sequelize } = require('../models');
const { ApiError } = require('../middleware/errorHandler');

const overview = async ({ from, to }) => {
  const totalUsers = await User.count();
  return { totalUsers, from, to };
};

const listUsers = async () => User.findAll({ limit: 100 });

const restore = async ({ entity_type, id }) => {
  switch (entity_type) {
    case 'user':
      await User.restore({ where: { id } });
      break;
    case 'profile':
      await Profile.restore({ where: { id } });
      break;
    case 'post':
      await Post.restore({ where: { id } });
      break;
    case 'comment':
      await Comment.restore({ where: { id } });
      break;
    default:
      throw new ApiError(400, `Unsupported entity type: ${entity_type}`, 'UNSUPPORTED_ENTITY');
  }
  return { success: true };
};

module.exports = { overview, listUsers, restore };
