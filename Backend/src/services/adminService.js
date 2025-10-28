const { User, Profile, Job, JobStage, JobApplication, Scorecard, Interview } = require('../models');
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
    case 'job':
      await Job.restore({ where: { id } });
      break;
    case 'job_stage':
      await JobStage.restore({ where: { id } });
      break;
    case 'job_application':
      await JobApplication.restore({ where: { id } });
      break;
    case 'scorecard':
      await Scorecard.restore({ where: { id } });
      break;
    case 'interview':
      await Interview.restore({ where: { id } });
      break;
    default:
      throw new ApiError(400, 'Unsupported entity type', 'UNSUPPORTED_ENTITY');
  }
  return { success: true };
};

module.exports = { overview, listUsers, restore };
