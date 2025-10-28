const { User, Profile, Organization, Project, Gig, Job, Group } = require('../models');
const { ApiError } = require('../middleware/errorHandler');

const overview = async ({ from, to }) => {
  const totalUsers = await User.count();
  return { totalUsers, from, to };
};

const listUsers = async () => User.findAll({ limit: 100 });

const restore = async ({ entity_type, id }) => {
  const mapping = {
    user: User,
    profile: Profile,
    organization: Organization,
    project: Project,
    gig: Gig,
    job: Job,
    group: Group,
  };

  const model = mapping[entity_type];
  if (!model) {
    throw new ApiError(400, `Unsupported entity_type: ${entity_type}`, 'UNSUPPORTED_ENTITY_TYPE');
  }

  const restored = await model.restore({ where: { id } });
  if (!restored) {
    throw new ApiError(404, 'Entity not found', 'ENTITY_NOT_FOUND');
  }
  return { success: true };
};

module.exports = { overview, listUsers, restore };
