const { User, Profile, Job, JobStage, JobApplication, Scorecard, Interview } = require('../models');
const { User, Profile, Conversation, Message, sequelize } = require('../models');
const { User, Profile, Connection, sequelize } = require('../models');
const {
  User,
  Profile,
  ProfileExperience,
  ProfileEducation,
  PortfolioItem,
  Review,
  FreelancerProfile,
  AgencyProfile,
  CompanyProfile,
  NetworkingLobby,
  NetworkingSession,
  NetworkingSessionParticipant,
  NetworkingSessionFeedback,
  LiveSignal,
} = require('../models');
const { ApiError } = require('../middleware/errorHandler');

const overview = async ({ from, to }) => {
  const totalUsers = await User.count();
  return { totalUsers, from, to };
};

const listUsers = async () => User.findAll({ limit: 100 });

const RESTORABLE_MODELS = {
  user: User,
  profile: Profile,
  profile_experience: ProfileExperience,
  profile_education: ProfileEducation,
  portfolio_item: PortfolioItem,
  review: Review,
  freelancer_profile: FreelancerProfile,
  agency_profile: AgencyProfile,
  company_profile: CompanyProfile,
};

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
  const model = RESTORABLE_MODELS[entity_type];

  if (!model || typeof model.restore !== 'function') {
    throw new ApiError(400, 'Unsupported entity type for restore', 'UNSUPPORTED_ENTITY');
  }

  const result = await model.restore({ where: { id } });
  const restoredCount = Array.isArray(result) ? result[0] : result;

  if (!restoredCount) {
    throw new ApiError(404, 'Entity not found or already active', 'ENTITY_NOT_FOUND');
const RESTORE_MODELS = {
  user: User,
  profile: Profile,
  networking_lobby: NetworkingLobby,
  networking_session: NetworkingSession,
  networking_session_participant: NetworkingSessionParticipant,
  networking_session_feedback: NetworkingSessionFeedback,
  live_signal: LiveSignal,
};

const restore = async ({ entity_type, id }) => {
  const model = RESTORE_MODELS[entity_type];
  if (!model) {
    throw new ApiError(400, `Unsupported entity type: ${entity_type}`, 'UNSUPPORTED_RESTORE');
  }

  const restored = await model.restore({ where: { id } });
  const restoredCount = Array.isArray(restored) ? restored[0] : restored;

  if (!restoredCount) {
    throw new ApiError(404, 'Entity not found or not deleted', 'RESTORE_NOT_FOUND');
  }
  if (entity_type === 'connection') {
    await Connection.restore({ where: { id } });
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
