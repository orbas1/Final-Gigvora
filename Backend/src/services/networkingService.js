const dayjs = require('dayjs');
const { Op } = require('sequelize');
const { v4: uuid } = require('uuid');
const {
  NetworkingLobby,
  NetworkingSession,
  NetworkingSessionParticipant,
  NetworkingSessionFeedback,
  User,
  Profile,
  sequelize,
} = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { buildPagination, encodeCursor } = require('../utils/pagination');
const { aggregateByPeriod } = require('../utils/analytics');
const { persistIdempotentResponse } = require('../middleware/idempotency');

const aliasCache = new Set();

const ALLOWED_LOBBY_FIELDS = new Set([
  'id',
  'topic',
  'description',
  'duration_minutes',
  'is_paid',
  'status',
  'max_participants',
  'metadata',
  'created_by',
  'created_at',
  'updated_at',
  'deleted_at',
]);

const ALLOWED_EXPANDS = new Set(['creator', 'sessions', 'stats']);

const sanitizeFields = (fields) => {
  if (!fields || !fields.length) return null;
  const unique = Array.from(new Set(fields.map((field) => String(field).trim())));
  const sanitized = unique.filter((field) => ALLOWED_LOBBY_FIELDS.has(field));
  if (!sanitized.includes('id')) {
    sanitized.unshift('id');
  }
  return sanitized;
};

const sanitizeExpand = (expand) => {
  if (!expand || !expand.length) return new Set();
  return new Set(
    expand
      .map((value) => String(value).trim().toLowerCase())
      .filter((value) => ALLOWED_EXPANDS.has(value))
  );
};

const formatDate = (value) => (value ? new Date(value).toISOString() : null);

const filterFields = (data, fields) => {
  if (!fields || !fields.length) {
    return data;
  }
  const output = {};
  fields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(data, field)) {
      output[field] = data[field];
    }
  });
  return output;
};

const buildLobbyIncludes = (expandSet, { paranoid }) => {
  if (!expandSet.size) {
    return [];
  }

  const includes = [];

  if (expandSet.has('creator')) {
    includes.push({
      model: User,
      as: 'creator',
      attributes: ['id', 'email', 'role'],
      include: [
        {
          model: Profile,
          as: 'profile',
          attributes: ['id', 'display_name', 'headline', 'location'],
        },
      ],
      paranoid,
    });
  }

  if (expandSet.has('sessions')) {
    includes.push({
      model: NetworkingSession,
      as: 'sessions',
      attributes: ['id', 'status', 'started_at', 'ended_at', 'last_activity_at', 'created_at', 'updated_at'],
      separate: true,
      order: [['created_at', 'DESC']],
      paranoid,
    });
  }

  return includes;
};

const loadLobbyStats = async (lobbyIds, { includeDeletedSessions = false } = {}) => {
  const statsMap = new Map();
  if (!Array.isArray(lobbyIds) || lobbyIds.length === 0) {
    return statsMap;
  }

  lobbyIds.forEach((id) => {
    statsMap.set(id, {
      total_sessions: 0,
      active_sessions: 0,
      waiting_sessions: 0,
      completed_sessions: 0,
      cancelled_sessions: 0,
      waiting_participants: 0,
      ratings_submitted: 0,
      average_rating: 0,
    });
  });

  const paranoid = !includeDeletedSessions;
  const where = { lobby_id: { [Op.in]: lobbyIds } };

  const statusRows = await NetworkingSession.findAll({
    attributes: [
      'lobby_id',
      'status',
      [sequelize.fn('COUNT', sequelize.col('*')), 'count'],
    ],
    where,
    group: ['lobby_id', 'status'],
    paranoid,
    raw: true,
  });

  statusRows.forEach((row) => {
    const lobbyStats = statsMap.get(row.lobby_id);
    if (!lobbyStats) {
      return;
    }
    const count = Number(row.count) || 0;
    lobbyStats.total_sessions += count;
    const statusKey = `${row.status}_sessions`;
    if (Object.prototype.hasOwnProperty.call(lobbyStats, statusKey)) {
      lobbyStats[statusKey] = count;
    }
  });

  const participantRows = await NetworkingSessionParticipant.findAll({
    attributes: [[sequelize.col('session.lobby_id'), 'lobby_id'], [sequelize.fn('COUNT', sequelize.col('*')), 'count']],
    include: [
      {
        model: NetworkingSession,
        as: 'session',
        attributes: [],
        where: { lobby_id: { [Op.in]: lobbyIds }, status: 'waiting' },
        required: true,
        paranoid,
      },
    ],
    where: { left_at: null },
    group: ['session.lobby_id'],
    paranoid,
    raw: true,
  });

  participantRows.forEach((row) => {
    const lobbyStats = statsMap.get(row.lobby_id);
    if (lobbyStats) {
      lobbyStats.waiting_participants = Number(row.count) || 0;
    }
  });

  const ratingRows = await NetworkingSessionFeedback.findAll({
    attributes: [
      [sequelize.col('session.lobby_id'), 'lobby_id'],
      [sequelize.fn('AVG', sequelize.col('stars')), 'average_rating'],
      [sequelize.fn('COUNT', sequelize.col('*')), 'count'],
    ],
    include: [
      {
        model: NetworkingSession,
        as: 'session',
        attributes: [],
        where,
        required: true,
        paranoid,
      },
    ],
    group: ['session.lobby_id'],
    paranoid,
    raw: true,
  });

  ratingRows.forEach((row) => {
    const lobbyStats = statsMap.get(row.lobby_id);
    if (!lobbyStats) {
      return;
    }
    lobbyStats.ratings_submitted = Number(row.count) || 0;
    const average = Number(row.average_rating);
    lobbyStats.average_rating = Number.isFinite(average) ? Number(average.toFixed(2)) : 0;
  });

  return statsMap;
};

const serializeLobby = (lobby, { fields, expandSet, stats, includeDeleted }) => {
  const base = {
    id: lobby.id,
    topic: lobby.topic,
    description: lobby.description,
    duration_minutes: lobby.duration_minutes,
    is_paid: lobby.is_paid,
    status: lobby.status,
    max_participants: lobby.max_participants,
    metadata: lobby.metadata || null,
    created_by: lobby.created_by,
    created_at: formatDate(lobby.createdAt || lobby.created_at),
    updated_at: formatDate(lobby.updatedAt || lobby.updated_at),
  };

  if (includeDeleted || lobby.deletedAt || lobby.deleted_at) {
    base.deleted_at = formatDate(lobby.deletedAt || lobby.deleted_at);
  }

  const payload = filterFields(base, fields);

  if (expandSet.has('creator')) {
    const creator = lobby.creator
      ? {
          id: lobby.creator.id,
          email: lobby.creator.email,
          role: lobby.creator.role,
          profile: lobby.creator.profile
            ? {
                id: lobby.creator.profile.id,
                display_name: lobby.creator.profile.display_name,
                headline: lobby.creator.profile.headline,
                location: lobby.creator.profile.location,
              }
            : null,
        }
      : null;
    payload.creator = creator;
  }

  if (expandSet.has('sessions')) {
    const sessions = (lobby.sessions || []).map((session) => ({
      id: session.id,
      status: session.status,
      started_at: formatDate(session.started_at || session.startedAt),
      ended_at: formatDate(session.ended_at || session.endedAt),
      last_activity_at: formatDate(session.last_activity_at || session.lastActivityAt),
      created_at: formatDate(session.created_at || session.createdAt),
      updated_at: formatDate(session.updated_at || session.updatedAt),
    }));
    payload.sessions = sessions;
  }

  if (expandSet.has('stats')) {
    payload.stats = {
      total_sessions: stats?.total_sessions ?? 0,
      active_sessions: stats?.active_sessions ?? 0,
      waiting_sessions: stats?.waiting_sessions ?? 0,
      completed_sessions: stats?.completed_sessions ?? 0,
      cancelled_sessions: stats?.cancelled_sessions ?? 0,
      waiting_participants: stats?.waiting_participants ?? 0,
      ratings_submitted: stats?.ratings_submitted ?? 0,
      average_rating: stats?.average_rating ?? 0,
    };
  }

  return payload;
};

const loadLobby = async (lobbyId, { includeDeleted = false, expandSet } = {}) => {
  const paranoid = !includeDeleted;
  const lobby = await NetworkingLobby.findByPk(lobbyId, {
    include: buildLobbyIncludes(expandSet, { paranoid }),
    paranoid,
  });
  if (!lobby) {
    throw new ApiError(404, 'Lobby not found', 'LOBBY_NOT_FOUND');
  }
  return lobby;
};

const ensureAdmin = (user) => {
  if (!user || user.role !== 'admin') {
    throw new ApiError(403, 'Only administrators can perform this action', 'FORBIDDEN');
  }
};

const parseBoolean = (value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return undefined;
};

const parseDate = (value) => {
  if (!value) return undefined;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.toDate() : undefined;
};

const buildAlias = () => {
  let attempts = 0;
  while (attempts < 5) {
    const code = Math.floor(1000 + Math.random() * 9000);
    const alias = `Participant ${code}`;
    if (!aliasCache.has(alias)) {
      aliasCache.add(alias);
      setTimeout(() => aliasCache.delete(alias), 60_000);
      return alias;
    }
    attempts += 1;
  }
  return `Participant ${uuid().slice(0, 8)}`;
};

const buildSessionResponse = (session, currentUser) => {
  if (!session) return null;
  const json = session.toJSON();
  const participants = (json.participants || [])
    .map((participant) => ({
      id: participant.id,
      alias: participant.alias,
      is_self: participant.user_id === currentUser?.id,
      joined_at: participant.joined_at,
      left_at: participant.left_at,
    }))
    .sort((a, b) => new Date(a.joined_at) - new Date(b.joined_at));

  const peer = participants.find((participant) => !participant.is_self) || null;
  const feedback = json.feedback || [];
  const selfFeedback = currentUser
    ? feedback.find((entry) => entry.user_id === currentUser.id)
    : undefined;
  const averageRating = feedback.length
    ? feedback.reduce((total, entry) => total + Number(entry.stars || 0), 0) / feedback.length
    : null;

  return {
    id: json.id,
    status: json.status,
    started_at: json.started_at,
    ended_at: json.ended_at,
    last_activity_at: json.last_activity_at,
    room_token: json.room_token,
    metadata: json.metadata || null,
    lobby: json.lobby
      ? {
          id: json.lobby.id,
          topic: json.lobby.topic,
          description: json.lobby.description,
          duration_minutes: json.lobby.duration_minutes,
          is_paid: json.lobby.is_paid,
        }
      : null,
    participants,
    peer,
    feedback: {
      submitted: Boolean(selfFeedback),
      stars: selfFeedback?.stars ?? null,
      note: selfFeedback?.note ?? null,
      average: averageRating,
      count: feedback.length,
    },
  };
};

const applyLobbyFilters = (query) => {
  const filters = {};
  const andConditions = [];

  if (query.duration !== undefined) {
    filters.duration_minutes = Number(query.duration);
  }

  const paid = parseBoolean(query.paid);
  if (paid !== undefined) {
    filters.is_paid = paid;
  }

  if (query.topic) {
    andConditions.push({
      [Op.or]: [
        sequelize.where(sequelize.fn('lower', sequelize.col('networking_lobbies.topic')), {
          [Op.like]: `%${String(query.topic).toLowerCase()}%`,
        }),
        sequelize.where(sequelize.fn('lower', sequelize.col('networking_lobbies.description')), {
          [Op.like]: `%${String(query.topic).toLowerCase()}%`,
        }),
      ],
    });
  }

  if (query.q) {
    const term = `%${String(query.q).toLowerCase()}%`;
    andConditions.push({
      [Op.or]: [
        sequelize.where(sequelize.fn('lower', sequelize.col('networking_lobbies.topic')), {
          [Op.like]: term,
        }),
        sequelize.where(sequelize.fn('lower', sequelize.col('networking_lobbies.description')), {
          [Op.like]: term,
        }),
      ],
    });
  }

  return { filters, andConditions };
};

const includeDeleted = (user, query) => user?.role === 'admin' && query.include === 'deleted';

const listLobbies = async (user, query) => {
  const { filters, andConditions } = applyLobbyFilters(query);
  const pagination = buildPagination(query, ['created_at', 'duration_minutes', 'topic']);
  const where = { ...filters };

  if (pagination.cursorValue !== undefined) {
    where[pagination.sortField] = { [pagination.cursorOperator]: pagination.cursorValue };
  }

  if (andConditions.length) {
    where[Op.and] = [...(where[Op.and] || []), ...andConditions];
  }

  const paranoid = !includeDeleted(user, query);

  const fields = sanitizeFields(query.fields);
  const expandSet = sanitizeExpand(query.expand);

  const lobbies = await NetworkingLobby.findAll({
    where,
    limit: pagination.limit,
    order: pagination.order,
    paranoid,
    include: buildLobbyIncludes(expandSet, { paranoid }),
  });

  const statsMap = expandSet.has('stats')
    ? await loadLobbyStats(
        lobbies.map((lobby) => lobby.id),
        {
          includeDeletedSessions: !paranoid,
        }
      )
    : new Map();

  const data = lobbies.map((lobby) =>
    serializeLobby(lobby, {
      fields,
      expandSet,
      includeDeleted: !paranoid,
      stats: statsMap.get(lobby.id),
    })
  );

  const nextCursor =
    lobbies.length === pagination.limit
      ? encodeCursor(lobbies[lobbies.length - 1].get(pagination.sortField))
      : null;

  const response = {
    data,
    meta: {
      next_cursor: nextCursor,
      limit: pagination.limit,
      sort: query.sort || 'created_at:desc',
    },
  };

  if (parseBoolean(query.analytics)) {
    const baseWhere = { ...filters };
    if (andConditions.length) {
      baseWhere[Op.and] = [...(baseWhere[Op.and] || []), ...andConditions];
    }

    const [totalLobbies, openLobbies, activeSessions, waitingParticipants] = await Promise.all([
      NetworkingLobby.count({ where: baseWhere, paranoid }),
      NetworkingLobby.count({ where: { ...baseWhere, status: 'open' }, paranoid }),
      NetworkingSession.count({
        include: [
          {
            model: NetworkingLobby,
            as: 'lobby',
            required: true,
            where: baseWhere,
            paranoid,
          },
        ],
        where: { status: 'active' },
      }),
      NetworkingSessionParticipant.count({
        include: [
          {
            model: NetworkingSession,
            as: 'session',
            required: true,
            where: { status: 'waiting' },
            include: [
              {
                model: NetworkingLobby,
                as: 'lobby',
                required: true,
                where: baseWhere,
                paranoid,
              },
            ],
          },
        ],
        where: { left_at: null },
      }),
    ]);

    response.analytics = {
      total_lobbies: totalLobbies,
      open_lobbies: openLobbies,
      active_sessions: activeSessions,
      waiting_participants: waitingParticipants,
    };
  }

  return response;
};

const createLobby = async (user, payload, viewOptions = {}) => {
  ensureAdmin(user);

  const lobby = await NetworkingLobby.create({
    topic: payload.topic,
    description: payload.description,
    duration_minutes: payload.duration_minutes,
    is_paid: payload.is_paid,
    status: payload.status || 'open',
    max_participants: payload.max_participants || 2,
    created_by: user.id,
    metadata: payload.metadata || null,
  });

  const fields = sanitizeFields(viewOptions.fields);
  const expandSet = sanitizeExpand(viewOptions.expand);

  if (expandSet.size) {
    await lobby.reload({ include: buildLobbyIncludes(expandSet, { paranoid: true }) });
  }

  const statsMap = expandSet.has('stats') ? await loadLobbyStats([lobby.id]) : new Map();

  return serializeLobby(lobby, {
    fields,
    expandSet,
    includeDeleted: false,
    stats: statsMap.get(lobby.id),
  });
};

const getLobby = async (user, lobbyId, viewOptions = {}) => {
  const includeDeletedLobby = includeDeleted(user, viewOptions);
  const fields = sanitizeFields(viewOptions.fields);
  const expandSet = sanitizeExpand(viewOptions.expand);
  const lobby = await loadLobby(lobbyId, { includeDeleted: includeDeletedLobby, expandSet });
  const statsMap = expandSet.has('stats')
    ? await loadLobbyStats([lobby.id], { includeDeletedSessions: includeDeletedLobby })
    : new Map();

  return serializeLobby(lobby, {
    fields,
    expandSet,
    includeDeleted: includeDeletedLobby,
    stats: statsMap.get(lobby.id),
  });
};

const updateLobby = async (user, lobbyId, payload, viewOptions = {}) => {
  ensureAdmin(user);
  const includeDeletedLobby = includeDeleted(user, viewOptions);
  const fields = sanitizeFields(viewOptions.fields);
  const expandSet = sanitizeExpand(viewOptions.expand);
  const lobby = await loadLobby(lobbyId, { includeDeleted: includeDeletedLobby, expandSet });

  if (lobby.deletedAt) {
    throw new ApiError(409, 'Lobby has been deleted', 'LOBBY_DELETED');
  }

  const updatable = [
    'topic',
    'description',
    'duration_minutes',
    'is_paid',
    'status',
    'max_participants',
    'metadata',
  ];

  updatable.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(payload, field) && payload[field] !== undefined) {
      lobby[field] = payload[field];
    }
  });

  await lobby.save();

  if (expandSet.size) {
    await lobby.reload({ include: buildLobbyIncludes(expandSet, { paranoid: true }) });
  }

  const statsMap = expandSet.has('stats') ? await loadLobbyStats([lobby.id]) : new Map();

  return serializeLobby(lobby, {
    fields,
    expandSet,
    includeDeleted: includeDeletedLobby,
    stats: statsMap.get(lobby.id),
  });
};

const deleteLobby = async (user, lobbyId, viewOptions = {}) => {
  ensureAdmin(user);
  const fields = sanitizeFields(viewOptions.fields);
  const expandSet = sanitizeExpand(viewOptions.expand);
  const lobby = await loadLobby(lobbyId, { includeDeleted: true, expandSet });

  if (lobby.deletedAt) {
    throw new ApiError(409, 'Lobby already deleted', 'LOBBY_ALREADY_DELETED');
  }

  await lobby.destroy();

  const statsMap = expandSet.has('stats')
    ? await loadLobbyStats([lobby.id], { includeDeletedSessions: true })
    : new Map();

  return serializeLobby(lobby, {
    fields,
    expandSet,
    includeDeleted: true,
    stats: statsMap.get(lobby.id),
  });
};

const findActiveParticipant = async (userId, transaction) => {
  return NetworkingSessionParticipant.findOne({
    where: { user_id: userId, left_at: null },
    include: [
      {
        model: NetworkingSession,
        as: 'session',
        where: { status: { [Op.in]: ['waiting', 'active'] } },
      },
    ],
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });
};

const loadSession = async (sessionId, currentUser, transaction) => {
  const session = await NetworkingSession.findByPk(sessionId, {
    include: [
      { model: NetworkingLobby, as: 'lobby' },
      { model: NetworkingSessionParticipant, as: 'participants' },
      { model: NetworkingSessionFeedback, as: 'feedback' },
    ],
    transaction,
  });
  if (!session) {
    throw new ApiError(404, 'Session not found', 'SESSION_NOT_FOUND');
  }
  return buildSessionResponse(session, currentUser);
};

const joinLobby = async (req, res, user, payload) => {
  return sequelize.transaction(async (transaction) => {
    const lobby = await NetworkingLobby.findByPk(payload.lobby_id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!lobby) {
      throw new ApiError(404, 'Lobby not found', 'LOBBY_NOT_FOUND');
    }
    if (lobby.status !== 'open') {
      throw new ApiError(409, 'Lobby is not accepting new sessions', 'LOBBY_CLOSED');
    }

    const activeParticipant = await findActiveParticipant(user.id, transaction);
    if (activeParticipant) {
      throw new ApiError(409, 'You are already participating in a session', 'ALREADY_IN_SESSION');
    }

    const waitingSession = await NetworkingSession.findOne({
      where: { lobby_id: lobby.id, status: 'waiting' },
      order: [['created_at', 'ASC']],
      transaction,
      lock: transaction.LOCK.UPDATE,
      include: [{ model: NetworkingSessionParticipant, as: 'participants' }],
    });

    let session;
    if (waitingSession && waitingSession.participants.length < lobby.max_participants) {
      session = waitingSession;
      await NetworkingSessionParticipant.create(
        {
          session_id: session.id,
          user_id: user.id,
          alias: buildAlias(),
        },
        { transaction }
      );
      session.status = 'active';
      session.started_at = new Date();
      session.last_activity_at = new Date();
      await session.save({ transaction });
    } else {
      session = await NetworkingSession.create(
        {
          lobby_id: lobby.id,
          status: 'waiting',
          room_token: uuid(),
          metadata: { duration_minutes: lobby.duration_minutes },
          last_activity_at: new Date(),
        },
        { transaction }
      );
      await NetworkingSessionParticipant.create(
        {
          session_id: session.id,
          user_id: user.id,
          alias: buildAlias(),
        },
        { transaction }
      );
    }

    const response = await loadSession(session.id, user, transaction);
    const status = waitingSession ? 200 : 201;
    await persistIdempotentResponse(req, res, { status, body: response });
    return { payload: response, status };
  });
};

const getSession = async (user, sessionId) => {
  const session = await NetworkingSession.findByPk(sessionId, {
    include: [
      { model: NetworkingLobby, as: 'lobby' },
      { model: NetworkingSessionParticipant, as: 'participants' },
      { model: NetworkingSessionFeedback, as: 'feedback' },
    ],
  });
  if (!session) {
    throw new ApiError(404, 'Session not found', 'SESSION_NOT_FOUND');
  }

  const isParticipant = session.participants.some((participant) => participant.user_id === user.id);
  if (!isParticipant && user.role !== 'admin') {
    throw new ApiError(403, 'You are not part of this session', 'FORBIDDEN');
  }

  return buildSessionResponse(session, user);
};

const leaveSession = async (user, sessionId) => {
  return sequelize.transaction(async (transaction) => {
    const session = await NetworkingSession.findByPk(sessionId, {
      include: [{ model: NetworkingSessionParticipant, as: 'participants' }],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!session) {
      throw new ApiError(404, 'Session not found', 'SESSION_NOT_FOUND');
    }

    const participant = session.participants.find((p) => p.user_id === user.id);
    if (!participant) {
      throw new ApiError(403, 'You are not part of this session', 'FORBIDDEN');
    }

    if (!participant.left_at) {
      participant.left_at = new Date();
      await participant.save({ transaction });
    }

    session.last_activity_at = new Date();

    if (session.status === 'waiting') {
      session.status = 'cancelled';
      session.ended_at = new Date();
    } else {
      const remaining = await NetworkingSessionParticipant.count({
        where: { session_id: session.id, left_at: null },
        transaction,
      });
      if (remaining === 0) {
        session.status = 'completed';
        session.ended_at = new Date();
      }
    }

    await session.save({ transaction });

    return loadSession(session.id, user, transaction);
  });
};

const rateSession = async (user, sessionId, payload) => {
  return sequelize.transaction(async (transaction) => {
    const session = await NetworkingSession.findByPk(sessionId, {
      include: [{ model: NetworkingSessionParticipant, as: 'participants' }],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!session) {
      throw new ApiError(404, 'Session not found', 'SESSION_NOT_FOUND');
    }

    const participant = session.participants.find((p) => p.user_id === user.id);
    if (!participant) {
      throw new ApiError(403, 'You are not part of this session', 'FORBIDDEN');
    }

    const [feedback] = await NetworkingSessionFeedback.findOrCreate({
      where: { session_id: session.id, user_id: user.id },
      defaults: { stars: payload.stars, note: payload.note },
      transaction,
    });

    if (!feedback.isNewRecord) {
      feedback.stars = payload.stars;
      feedback.note = payload.note;
      await feedback.save({ transaction });
    }

    return loadSession(session.id, user, transaction);
  });
};

const analyticsUsage = async (query) => {
  const granularity = query.by || 'day';
  const fromDate = parseDate(query.from);
  const toDate = parseDate(query.to);
  const replacements = {};
  const sessionFilters = [];

  if (query.duration !== undefined) {
    sessionFilters.push(
      "lobby_id IN (SELECT id FROM networking_lobbies WHERE deleted_at IS NULL AND duration_minutes = :duration)"
    );
    replacements.duration = Number(query.duration);
  }

  const sessionFilterParts = [
    'session_id IN (SELECT id FROM networking_sessions WHERE deleted_at IS NULL',
  ];
  if (query.duration !== undefined) {
    sessionFilterParts.push(
      'AND lobby_id IN (SELECT id FROM networking_lobbies WHERE deleted_at IS NULL AND duration_minutes = :duration)'
    );
  }
  sessionFilterParts.push(')');
  const participantSessionFilter = sessionFilterParts.join(' ');
  const ratingSessionFilter = participantSessionFilter;

  const [sessionBuckets, completedBuckets, participantBuckets, ratingBuckets] = await Promise.all([
    aggregateByPeriod(NetworkingSession, 'created_at', {
      granularity,
      from: fromDate,
      to: toDate,
      extraWhere: sessionFilters,
      replacements,
    }),
    aggregateByPeriod(NetworkingSession, 'created_at', {
      granularity,
      from: fromDate,
      to: toDate,
      extraWhere: [...sessionFilters, "status = 'completed'"] ,
      replacements,
    }),
    aggregateByPeriod(NetworkingSessionParticipant, 'joined_at', {
      granularity,
      from: fromDate,
      to: toDate,
      extraWhere: [participantSessionFilter],
      replacements,
      distinct: 'user_id',
    }),
    aggregateByPeriod(NetworkingSessionFeedback, 'created_at', {
      granularity,
      from: fromDate,
      to: toDate,
      extraWhere: [ratingSessionFilter],
      replacements,
    }),
  ]);

  const mergeBuckets = () => {
    const index = new Map();
    const attach = (rows, key) => {
      rows.forEach((row) => {
        const bucket = row.bucket;
        if (!index.has(bucket)) {
          index.set(bucket, { bucket, sessions: 0, completed_sessions: 0, unique_participants: 0, ratings_submitted: 0 });
        }
        index.get(bucket)[key] = row.count;
      });
    };
    attach(sessionBuckets, 'sessions');
    attach(completedBuckets, 'completed_sessions');
    attach(participantBuckets, 'unique_participants');
    attach(ratingBuckets, 'ratings_submitted');
    return Array.from(index.values()).sort((a, b) => (a.bucket > b.bucket ? 1 : -1));
  };

  const buckets = mergeBuckets();

  const sessionDateWhere = {};
  if (fromDate) {
    sessionDateWhere.created_at = { ...(sessionDateWhere.created_at || {}), [Op.gte]: fromDate };
  }
  if (toDate) {
    sessionDateWhere.created_at = { ...(sessionDateWhere.created_at || {}), [Op.lte]: toDate };
  }

  const sessionInclude = [
    {
      model: NetworkingLobby,
      as: 'lobby',
      attributes: [],
      required: query.duration !== undefined,
      where: query.duration !== undefined ? { duration_minutes: Number(query.duration) } : undefined,
    },
  ];

  const participantDateWhere = {};
  if (fromDate) {
    participantDateWhere.joined_at = { ...(participantDateWhere.joined_at || {}), [Op.gte]: fromDate };
  }
  if (toDate) {
    participantDateWhere.joined_at = { ...(participantDateWhere.joined_at || {}), [Op.lte]: toDate };
  }

  const ratingDateWhere = {};
  if (fromDate) {
    ratingDateWhere.created_at = { ...(ratingDateWhere.created_at || {}), [Op.gte]: fromDate };
  }
  if (toDate) {
    ratingDateWhere.created_at = { ...(ratingDateWhere.created_at || {}), [Op.lte]: toDate };
  }

  const [totalSessions, completedSessions, activeSessions, uniqueParticipants, ratingSummary] = await Promise.all([
    NetworkingSession.count({ where: sessionDateWhere, include: sessionInclude }),
    NetworkingSession.count({ where: { ...sessionDateWhere, status: 'completed' }, include: sessionInclude }),
    NetworkingSession.count({ where: { ...sessionDateWhere, status: 'active' }, include: sessionInclude }),
    NetworkingSessionParticipant.count({
      distinct: true,
      col: 'user_id',
      where: participantDateWhere,
      include: [
        {
          model: NetworkingSession,
          as: 'session',
          attributes: [],
          required: true,
          where: sessionDateWhere,
          include: sessionInclude,
        },
      ],
    }),
    NetworkingSessionFeedback.findOne({
      attributes: [
        [sequelize.fn('AVG', sequelize.col('stars')), 'average_rating'],
        [sequelize.fn('COUNT', sequelize.col('*')), 'ratings_submitted'],
      ],
      where: ratingDateWhere,
      include: [
        {
          model: NetworkingSession,
          as: 'session',
          attributes: [],
          required: true,
          where: sessionDateWhere,
          include: sessionInclude,
        },
      ],
      raw: true,
    }),
  ]);

  return {
    buckets,
    totals: {
      sessions: totalSessions,
      completed_sessions: completedSessions,
      active_sessions: activeSessions,
      unique_participants,
      average_rating: ratingSummary ? Number(ratingSummary.average_rating || 0) || 0 : 0,
      ratings_submitted: ratingSummary ? Number(ratingSummary.ratings_submitted || 0) : 0,
    },
  };
};

module.exports = {
  listLobbies,
  createLobby,
  getLobby,
  updateLobby,
  deleteLobby,
  joinLobby,
  getSession,
  leaveSession,
  rateSession,
  analyticsUsage,
};
