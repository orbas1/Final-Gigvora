const { User, Profile } = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const supportService = require('./supportService');

const overview = async ({ from, to }) => {
  const totalUsers = await User.count();
  return { totalUsers, from, to };
};

const listUsers = async () => User.findAll({ limit: 100 });

const normalizeRestoreResult = (result) => {
  if (Array.isArray(result)) {
    return result[0] > 0;
  }
  return Boolean(result);
};

const restore = async ({ entity_type, id }, currentUser) => {
  switch (entity_type) {
    case 'user': {
      const restored = await User.restore({ where: { id } });
      if (!normalizeRestoreResult(restored)) {
        throw new ApiError(404, 'User not found or not deleted', 'USER_NOT_FOUND');
      }
      return { success: true };
    }
    case 'profile': {
      const restored = await Profile.restore({ where: { id } });
      if (!normalizeRestoreResult(restored)) {
        throw new ApiError(404, 'Profile not found or not deleted', 'PROFILE_NOT_FOUND');
      }
      return { success: true };
    }
    case 'support_ticket': {
      const ticket = await supportService.restoreTicket(id, currentUser);
      return { success: true, ticket };
    }
    default:
      throw new ApiError(400, 'Unsupported entity type for restore', 'INVALID_ENTITY_TYPE');
  }
};

module.exports = { overview, listUsers, restore };
