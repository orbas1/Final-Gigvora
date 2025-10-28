const {
  User,
  Profile,
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

  return { success: true };
};

module.exports = { overview, listUsers, restore };
