const { User, Profile, Company, Agency, CompanyEmployee, AgencyMember } = require('../models');
const { User, Profile, Group } = require('../models');
const { User, Profile, Post, Comment, sequelize } = require('../models');
const { User, Profile, LegalDocument, LegalConsent, WebhookSubscription, WebhookDelivery } = require('../models');
const { User, Profile } = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const supportService = require('./supportService');
const {
  User,
  Profile,
  WalletPaymentMethod,
  WalletPayoutAccount,
  EscrowIntent,
  Payout,
  Refund,
  Invoice,
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
  const model = RESTORABLE_MODELS[entity_type];

  if (!model || typeof model.restore !== 'function') {
    throw new ApiError(400, 'Unsupported entity type for restore', 'UNSUPPORTED_ENTITY');
  }

  const result = await model.restore({ where: { id } });
  const restoredCount = Array.isArray(result) ? result[0] : result;

  if (!restoredCount) {
    throw new ApiError(404, 'Entity not found or already active', 'ENTITY_NOT_FOUND');
  }

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
const RESTORABLE = {
  user: User,
  profile: Profile,
  wallet_payment_method: WalletPaymentMethod,
  wallet_payout_account: WalletPayoutAccount,
  escrow_intent: EscrowIntent,
  payout: Payout,
  refund: Refund,
  invoice: Invoice,
};

const restore = async ({ entity_type, id }) => {
  const Model = RESTORABLE[entity_type];
  if (!Model) {
    throw new ApiError(400, 'Unsupported entity type', 'INVALID_ENTITY');
  }
  const [restored] = await Model.restore({ where: { id } });
  if (restored === 0) {
    throw new ApiError(404, 'Entity not found', 'ENTITY_NOT_FOUND');
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
    case 'legal_document':
      await LegalDocument.restore({ where: { id } });
      break;
    case 'legal_consent':
      await LegalConsent.restore({ where: { id } });
      break;
    case 'webhook_subscription':
      await WebhookSubscription.restore({ where: { id } });
      break;
    case 'webhook_delivery':
      await WebhookDelivery.restore({ where: { id } });
      break;
    default:
      throw new ApiError(400, 'Unsupported entity type for restoration', 'INVALID_ENTITY_TYPE');
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
  if (entity_type === 'group') {
    await Group.restore({ where: { id } });
  }
  if (entity_type === 'message') {
    await Message.restore({ where: { id } });
  }

  return { success: true };
};

module.exports = { overview, listUsers, restore };
