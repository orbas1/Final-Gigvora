const { User, Profile, FileAsset, Tag, Skill, sequelize } = require('../models');
const { ApiError } = require('../middleware/errorHandler');

const overview = async ({ from, to }) => {
  const totalUsers = await User.count();
  return { totalUsers, from, to };
};

const listUsers = async () => User.findAll({ limit: 100 });

const RESTORE_MAP = {
  user: User,
  profile: Profile,
  file: FileAsset,
  tag: Tag,
  skill: Skill,
};

const restore = async ({ entity_type, id }) => {
  const Model = RESTORE_MAP[entity_type];
  if (!Model) {
    throw new ApiError(400, 'Unsupported entity type for restore', 'UNSUPPORTED_ENTITY');
  }
  const [restored] = await Model.restore({ where: { id } });
  return { success: restored > 0 };
};

module.exports = { overview, listUsers, restore };
