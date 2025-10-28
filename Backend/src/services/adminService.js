const { User, Profile, Company, Agency, CompanyEmployee, AgencyMember } = require('../models');
const { ApiError } = require('../middleware/errorHandler');

const overview = async ({ from, to }) => {
  const totalUsers = await User.count();
  return { totalUsers, from, to };
};

const listUsers = async () => User.findAll({ limit: 100 });

const restore = async ({ entity_type, id }) => {
  if (!entity_type || !id) {
    throw new ApiError(400, 'entity_type and id are required', 'VALIDATION_ERROR');
  }

  if (entity_type === 'user') {
    if (typeof User.restore === 'function') {
      await User.restore({ where: { id } });
    }
    return { success: true };
  }

  if (entity_type === 'profile') {
    if (typeof Profile.restore === 'function') {
      await Profile.restore({ where: { id } });
    }
    return { success: true };
  }

  const restoreOrganization = async (Model, MemberModel, foreignKey) => {
    const restored = await Model.restore({ where: { id } });
    if (!restored) {
      throw new ApiError(404, 'Entity not found', 'NOT_FOUND');
    }

    if (typeof MemberModel.restore === 'function') {
      await MemberModel.restore({ where: { [foreignKey]: id } });
    }

    await MemberModel.update(
      { removed_at: null },
      { where: { [foreignKey]: id }, paranoid: false }
    );

    return { success: true };
  };

  if (entity_type === 'company') {
    return restoreOrganization(Company, CompanyEmployee, 'company_id');
  }

  if (entity_type === 'agency') {
    return restoreOrganization(Agency, AgencyMember, 'agency_id');
  }

  throw new ApiError(400, 'Unsupported entity type', 'UNSUPPORTED_ENTITY');
};

module.exports = { overview, listUsers, restore };
