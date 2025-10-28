const dayjs = require('dayjs');
const { Op } = require('sequelize');
const { ApiError } = require('../middleware/errorHandler');
const {
  NetworkingSession,
  NetworkingSessionParticipant,
  LiveSignal,
} = require('../models');

const ensureSessionParticipant = async (sessionId, user, transaction) => {
  const session = await NetworkingSession.findByPk(sessionId, {
    include: [{ model: NetworkingSessionParticipant, as: 'participants' }],
    transaction,
  });
  if (!session) {
    throw new ApiError(404, 'Session not found', 'SESSION_NOT_FOUND');
  }
  const isParticipant = session.participants.some((participant) => participant.user_id === user.id);
  if (!isParticipant && user.role !== 'admin') {
    throw new ApiError(403, 'You are not part of this session', 'FORBIDDEN');
  }
  return session;
};

const pruneSignals = async (sessionId) => {
  const cutoff = dayjs().subtract(1, 'hour').toDate();
  await LiveSignal.destroy({
    where: { session_id: sessionId, created_at: { [Op.lt]: cutoff } },
    force: true,
  });
};

const createSignal = async (user, type, payload) => {
  const session = await ensureSessionParticipant(payload.session_id, user);
  const ttlSeconds = Math.max(60, Math.min(Number(payload.expires_in) || 600, 3600));
  const expiresAt = dayjs().add(ttlSeconds, 'second').toDate();

  const targetParticipant =
    payload.target_id ||
    session.participants.find((participant) => participant.user_id !== user.id)?.user_id ||
    null;

  const record = await LiveSignal.create({
    session_id: session.id,
    sender_id: user.id,
    target_id: targetParticipant,
    signal_type: type,
    payload: payload.payload,
    expires_at: expiresAt,
  });

  await pruneSignals(session.id);

  return {
    id: record.id,
    session_id: record.session_id,
    signal_type: record.signal_type,
    sender_id: record.sender_id,
    target_id: record.target_id,
    payload: record.payload,
    created_at: record.createdAt,
    expires_at: record.expires_at,
  };
};

module.exports = {
  createSignal,
};
