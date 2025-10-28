const dayjs = require('dayjs');
const cloneDeep = require('lodash/cloneDeep');
const { Op } = require('sequelize');
const {
  CalendarEvent,
  CalendarEventParticipant,
  CalendarIntegration,
  CalendarIcsToken,
  User,
  sequelize,
} = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { buildPagination, encodeCursor } = require('../utils/pagination');

const parseDate = (value) => {
  if (!value) return undefined;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.toDate() : undefined;
};

const parseExpand = (value = '') =>
  new Set(
    String(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  );

const parseFields = (value) => {
  if (!value) return undefined;
  const parts = String(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return undefined;
  if (!parts.includes('id')) parts.push('id');
  return parts;
};

const serializeEvent = (event) => {
  if (!event) return null;
  const plain = event.get ? event.get({ plain: true }) : { ...event };
  delete plain.participantMemberships;
  return plain;
};

const resolveAccess = (user, query = {}) => {
  const baseWhere = {};
  let membershipInclude;

  if (user.role !== 'admin') {
    if (query.org_id && query.org_id !== user.org_id) {
      throw new ApiError(403, 'Forbidden org context', 'FORBIDDEN');
    }
  }

  if (user.role === 'admin') {
    if (query.scope === 'org' && !query.org_id) {
      throw new ApiError(400, 'org_id is required when scope=org', 'VALIDATION_ERROR');
    }

    if (query.scope === 'org') {
      baseWhere.scope = 'org';
      baseWhere.org_id = query.org_id;
      return { baseWhere, membershipInclude: null };
    }

    if (query.scope === 'user' && query.owner_id) {
      baseWhere.scope = 'user';
      baseWhere.owner_id = query.owner_id;
      return { baseWhere, membershipInclude: null };
    }

    if (query.owner_id) {
      baseWhere.owner_id = query.owner_id;
      if (query.scope) baseWhere.scope = query.scope;
      return { baseWhere, membershipInclude: null };
    }

    if (query.org_id) {
      baseWhere.scope = 'org';
      baseWhere.org_id = query.org_id;
      return { baseWhere, membershipInclude: null };
    }

    if (query.scope === 'user') {
      baseWhere.scope = 'user';
      return { baseWhere, membershipInclude: null };
    }

    return { baseWhere, membershipInclude: null };
  }

  if (query.scope === 'org') {
    const requestedOrgId = query.org_id;
    const orgId = requestedOrgId || user.org_id;
    if (!orgId) {
      throw new ApiError(400, 'Organization scope requested but user is not associated with an organization', 'ORG_REQUIRED');
    }
    if (requestedOrgId && requestedOrgId !== user.org_id) {
      throw new ApiError(403, 'Forbidden org context', 'FORBIDDEN');
    }
    baseWhere.scope = 'org';
    baseWhere.org_id = orgId;
    return { baseWhere, membershipInclude: null };
  }

  const orConditions = [{ owner_id: user.id }];
  if (user.org_id) {
    orConditions.push({ scope: 'org', org_id: user.org_id });
  }
  orConditions.push({ '$participantMemberships.user_id$': user.id });
  baseWhere[Op.or] = orConditions;

  membershipInclude = {
    model: CalendarEventParticipant,
    as: 'participantMemberships',
    attributes: [],
    required: false,
    where: { user_id: user.id },
    duplicating: false,
  };

  return { baseWhere, membershipInclude };
};

const applyFilters = (baseWhere, query, { includeCursor = true, pagination } = {}) => {
  const where = cloneDeep(baseWhere) || {};

  if (query.status) {
    where.status = query.status;
  }

  if (query.owner_id && !where.owner_id) {
    where.owner_id = query.owner_id;
  }

  if (query.org_id && !where.org_id) {
    where.org_id = query.org_id;
  }

  if (query.scope && query.scope !== 'all' && !where.scope) {
    where.scope = query.scope;
  }

  const fromDate = parseDate(query.from);
  const toDate = parseDate(query.to);
  if (fromDate || toDate) {
    const rangeConditions = [];
    if (toDate) {
      rangeConditions.push({ start_at: { [Op.lte]: toDate } });
    }
    if (fromDate) {
      rangeConditions.push({ end_at: { [Op.gte]: fromDate } });
    }
    if (rangeConditions.length) {
      where[Op.and] = [...(where[Op.and] || []), ...rangeConditions];
    }
  }

  if (query.q) {
    const dialect = CalendarEvent.sequelize.getDialect();
    const likeOperator = dialect === 'postgres' ? Op.iLike : Op.like;
    const search = `%${query.q.trim()}%`;
    const searchCondition = {
      [Op.or]: [
        { title: { [likeOperator]: search } },
        { description: { [likeOperator]: search } },
        { location: { [likeOperator]: search } },
      ],
    };
    where[Op.and] = [...(where[Op.and] || []), searchCondition];
  }

  if (includeCursor && pagination?.cursorValue !== undefined && pagination?.cursorValue !== null) {
    const field = pagination.sortField;
    where[field] = { ...(where[field] || {}), [pagination.cursorOperator]: pagination.cursorValue };
  }

  return where;
};

const buildIncludes = (expand, membershipInclude) => {
  const include = [];
  const participantExpanded = expand.has('participants') || expand.has('participants.user');

  if (expand.has('owner')) {
    include.push({
      model: User,
      as: 'owner',
      attributes: ['id', 'email', 'role', 'org_id', 'active_role'],
    });
  }

  if (participantExpanded) {
    const participantInclude = {
      model: CalendarEventParticipant,
      as: 'participants',
      include: [],
    };

    if (expand.has('participants.user')) {
      participantInclude.include.push({
        model: User,
        as: 'user',
        attributes: ['id', 'email', 'role', 'org_id'],
      });
    }

    include.push(participantInclude);
  }

  if (membershipInclude) {
    include.push(membershipInclude);
  }

  return include;
};

const buildEventAnalytics = async (baseWhere, membershipInclude, includeDeleted, query) => {
  const where = applyFilters(baseWhere, query, { includeCursor: false });
  const paranoid = !includeDeleted;
  const include = membershipInclude ? [membershipInclude] : undefined;

  const [total, upcoming, cancelled] = await Promise.all([
    CalendarEvent.count({ where, paranoid, include, distinct: true }),
    CalendarEvent.count({
      where: {
        ...cloneDeep(where),
        status: 'confirmed',
        start_at: { ...(where.start_at || {}), [Op.gte]: new Date() },
      },
      paranoid,
      include,
      distinct: true,
    }),
    CalendarEvent.count({
      where: { ...cloneDeep(where), status: 'cancelled' },
      paranoid,
      include,
      distinct: true,
    }),
  ]);

  return {
    total_events: total,
    upcoming_events: upcoming,
    cancelled_events: cancelled,
  };
};

const sanitizeAttendees = (attendees = []) =>
  attendees
    .map((attendee) => ({
      user_id: attendee.user_id || null,
      email: attendee.email || null,
      name: attendee.name || null,
      status: attendee.status || 'needs_action',
      role: attendee.role || 'attendee',
      responded_at: attendee.responded_at ? new Date(attendee.responded_at) : null,
      metadata: attendee.metadata || null,
    }))
    .filter((attendee) => attendee.user_id || attendee.email);

const attachOwnerParticipant = (attendees, user) => {
  const ownerExists = attendees.some(
    (attendee) => attendee.user_id === user.id || (attendee.email && attendee.email === user.email)
  );
  if (!ownerExists) {
    attendees.push({
      user_id: user.id,
      email: user.email,
      name: user.email,
      role: 'organizer',
      status: 'accepted',
      responded_at: new Date(),
      metadata: null,
    });
  }
  return attendees;
};

const listEvents = async (user, query) => {
  const pagination = buildPagination(query, ['start_at', 'created_at']);
  const expand = parseExpand(query.expand);
  const includeDeleted = query.include === 'deleted' && user.role === 'admin';
  const { baseWhere, membershipInclude } = resolveAccess(user, query);
  const where = applyFilters(baseWhere, query, { includeCursor: true, pagination });
  const include = buildIncludes(expand, membershipInclude);
  const attributes = parseFields(query.fields);

  const { rows, count } = await CalendarEvent.findAndCountAll({
    where,
    include,
    attributes,
    limit: pagination.limit,
    order: pagination.order,
    paranoid: !includeDeleted,
    distinct: true,
    subQuery: false,
  });

  const events = rows.map((row) => serializeEvent(row));

  const total = typeof count === 'number' ? count : count.length;
  const lastItem = rows[rows.length - 1];
  const nextCursorValue = lastItem ? lastItem.get(pagination.sortField) : null;
  const analytics =
    String(query.analytics).toLowerCase() === 'true'
      ? await buildEventAnalytics(baseWhere, membershipInclude, includeDeleted, query)
      : undefined;

  return {
    data: events,
    total,
    cursor: {
      next: nextCursorValue ? encodeCursor(nextCursorValue) : null,
    },
    analytics,
  };
};

const canAccessEvent = (user, event) => {
  if (!event) return false;
  if (user.role === 'admin') return true;
  if (event.owner_id === user.id) return true;
  if (event.scope === 'org' && event.org_id && user.org_id && event.org_id === user.org_id) return true;
  if (event.participants?.some((participant) => participant.user_id === user.id)) return true;
  if (event.participants?.some((participant) => participant.email && participant.email === user.email)) return true;
  return false;
};

const getEvent = async (user, id, options = {}) => {
  const { includeDeleted = false, transaction } = options;
  if (includeDeleted && user.role !== 'admin') {
    throw new ApiError(403, 'Only administrators may access deleted records', 'FORBIDDEN');
  }

  const include = [
    {
      model: CalendarEventParticipant,
      as: 'participants',
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'role', 'org_id'],
        },
      ],
    },
    {
      model: User,
      as: 'owner',
      attributes: ['id', 'email', 'role', 'org_id', 'active_role'],
    },
  ];

  const eventInstance = await CalendarEvent.findByPk(id, {
    include,
    paranoid: !includeDeleted,
    transaction,
  });

  if (!eventInstance) {
    throw new ApiError(404, 'Event not found', 'CALENDAR_EVENT_NOT_FOUND');
  }

  const event = serializeEvent(eventInstance);

  if (!canAccessEvent(user, event)) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }

  return event;
};

const ensureOrgContext = (user, payload) => {
  if (payload.scope === 'org') {
    const orgId = payload.org_id || user.org_id;
    if (!orgId) {
      throw new ApiError(400, 'Organization context required for org events', 'ORG_REQUIRED');
    }
    return { ...payload, org_id: orgId };
  }
  return { ...payload, org_id: null, scope: 'user' };
};

const createEvent = async (user, payload) => {
  const attendees = attachOwnerParticipant(sanitizeAttendees(payload.attendees), user);
  const eventPayload = ensureOrgContext(user, payload);

  return sequelize.transaction(async (transaction) => {
    const event = await CalendarEvent.create(
      {
        owner_id: user.id,
        org_id: eventPayload.org_id,
        title: eventPayload.title,
        description: eventPayload.description,
        location: eventPayload.location,
        start_at: eventPayload.start_at,
        end_at: eventPayload.end_at,
        all_day: eventPayload.all_day,
        visibility: eventPayload.visibility,
        scope: eventPayload.scope,
        status: eventPayload.status,
        source: eventPayload.source,
        metadata: eventPayload.metadata,
      },
      { transaction }
    );

    if (attendees.length) {
      await CalendarEventParticipant.bulkCreate(
        attendees.map((attendee) => ({ ...attendee, event_id: event.id })),
        { transaction }
      );
    }

    const created = await getEvent(user, event.id, { transaction });
    return created;
  });
};

const canManageEvent = (user, event) => {
  if (user.role === 'admin') return true;
  if (event.owner_id === user.id) return true;
  if (event.scope === 'org' && user.org_id && event.org_id === user.org_id) return true;
  return false;
};

const updateEvent = async (user, id, payload) => {
  return sequelize.transaction(async (transaction) => {
    const lock = transaction.LOCK?.UPDATE;
    const event = await CalendarEvent.findByPk(id, {
      include: [{ model: CalendarEventParticipant, as: 'participants' }],
      transaction,
      ...(lock ? { lock } : {}),
    });

    if (!event) {
      throw new ApiError(404, 'Event not found', 'CALENDAR_EVENT_NOT_FOUND');
    }

    if (!canManageEvent(user, event)) {
      throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
    }

    const updatedPayload = ensureOrgContext(user, { ...event.toJSON(), ...payload });

    if (!dayjs(updatedPayload.end_at).isAfter(dayjs(updatedPayload.start_at))) {
      throw new ApiError(400, 'end_at must be after start_at', 'VALIDATION_ERROR');
    }

    await event.update(
      {
        title: updatedPayload.title,
        description: updatedPayload.description,
        location: updatedPayload.location,
        start_at: updatedPayload.start_at,
        end_at: updatedPayload.end_at,
        all_day: updatedPayload.all_day,
        visibility: updatedPayload.visibility,
        scope: updatedPayload.scope,
        status: updatedPayload.status,
        source: updatedPayload.source,
        metadata: updatedPayload.metadata,
        org_id: updatedPayload.org_id,
      },
      { transaction }
    );

    if (payload.attendees) {
      await CalendarEventParticipant.destroy({ where: { event_id: event.id }, force: true, transaction });
      const attendees = attachOwnerParticipant(sanitizeAttendees(payload.attendees), user);
      if (attendees.length) {
        await CalendarEventParticipant.bulkCreate(
          attendees.map((attendee) => ({ ...attendee, event_id: event.id })),
          { transaction }
        );
      }
    }

    const updated = await getEvent(user, event.id, { transaction });
    return updated;
  });
};

const deleteEvent = async (user, id) =>
  sequelize.transaction(async (transaction) => {
    const lock = transaction.LOCK?.UPDATE;
    const event = await CalendarEvent.findByPk(id, {
      transaction,
      ...(lock ? { lock } : {}),
    });
    if (!event) {
      throw new ApiError(404, 'Event not found', 'CALENDAR_EVENT_NOT_FOUND');
    }
    if (!canManageEvent(user, event)) {
      throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
    }

    await CalendarEventParticipant.destroy({ where: { event_id: id }, transaction });
    await event.destroy({ transaction });
    await event.reload({ paranoid: false, transaction });

    return { success: true, deleted_at: event.deleted_at };
  });

const buildIcsDate = (date, allDay = false) => {
  const parsed = dayjs(date).utc();
  if (allDay) {
    return parsed.format('YYYYMMDD');
  }
  return parsed.format('YYYYMMDD[T]HHmmss[Z]');
};

const escapeText = (text = '') =>
  String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');

const buildIcsFeed = (events) => {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gigvora//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Gigvora Calendar',
  ];

  events.forEach((event) => {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.id}@gigvora`);
    lines.push(`DTSTAMP:${buildIcsDate(new Date())}`);
    lines.push(`DTSTART${event.all_day ? ';VALUE=DATE' : ''}:${buildIcsDate(event.start_at, event.all_day)}`);
    lines.push(`DTEND${event.all_day ? ';VALUE=DATE' : ''}:${buildIcsDate(event.end_at, event.all_day)}`);
    lines.push(`SUMMARY:${escapeText(event.title)}`);
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    }
    if (event.location) {
      lines.push(`LOCATION:${escapeText(event.location)}`);
    }
    const statusMap = {
      confirmed: 'CONFIRMED',
      tentative: 'TENTATIVE',
      cancelled: 'CANCELLED',
    };
    lines.push(`STATUS:${statusMap[event.status] || 'CONFIRMED'}`);

    if (Array.isArray(event.participants)) {
      event.participants.forEach((participant) => {
        const email = participant.email || participant.user?.email;
        if (!email) return;
        const params = [];
        if (participant.role) params.push(`ROLE=${participant.role.toUpperCase()}`);
        if (participant.status) params.push(`PARTSTAT=${participant.status.toUpperCase()}`);
        lines.push(`ATTENDEE;${params.join(';')}:mailto:${email}`);
      });
    }

    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
};

const getIcsFeed = async (token) => {
  if (!token) {
    throw new ApiError(400, 'token is required', 'VALIDATION_ERROR');
  }

  const tokenRecord = await CalendarIcsToken.scope('withRevoked').findOne({ where: { token } });
  if (!tokenRecord || tokenRecord.revoked_at) {
    throw new ApiError(404, 'ICS token not found', 'ICS_TOKEN_NOT_FOUND');
  }

  await tokenRecord.update({ last_used_at: new Date() });

  const events = await CalendarEvent.findAll({
    where: {
      owner_id: tokenRecord.user_id,
      status: { [Op.ne]: 'cancelled' },
    },
    include: [
      {
        model: CalendarEventParticipant,
        as: 'participants',
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'email', 'role', 'org_id'],
          },
        ],
      },
    ],
    order: [['start_at', 'ASC']],
  });

  return buildIcsFeed(events.map((event) => event.get({ plain: true })));
};

const connectIntegration = async (user, payload) => {
  const integration = await CalendarIntegration.findOne({
    where: { user_id: user.id, provider: payload.provider },
    paranoid: false,
  });

  if (integration) {
    if (integration.deleted_at) {
      await integration.restore();
    }
    await integration.update({
      external_account_id: payload.external_account_id,
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      expires_at: payload.expires_at,
      scope: payload.scope,
      settings: payload.settings,
      status: 'connected',
      revoked_at: null,
    });
    return { integration: integration.get({ plain: true }), created: false };
  }

  const createdIntegration = await CalendarIntegration.create({
    user_id: user.id,
    provider: payload.provider,
    external_account_id: payload.external_account_id,
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_at: payload.expires_at,
    scope: payload.scope,
    settings: payload.settings,
    status: 'connected',
  });
  return { integration: createdIntegration.get({ plain: true }), created: true };
};

const disconnectIntegration = async (user, provider) => {
  const integration = await CalendarIntegration.findOne({
    where: { user_id: user.id, provider },
    paranoid: false,
  });
  if (!integration) {
    throw new ApiError(404, 'Integration not found', 'INTEGRATION_NOT_FOUND');
  }
  await integration.update({ status: 'revoked', revoked_at: new Date() });
  if (!integration.deleted_at) {
    await integration.destroy();
  }
  return { success: true };
};

const busyHoursAnalytics = async (user, query = {}) => {
  if (query.by && query.by !== 'hour') {
    throw new ApiError(400, 'Unsupported aggregation granularity', 'VALIDATION_ERROR');
  }

  const from = parseDate(query.from) || dayjs().startOf('day').toDate();
  const to = parseDate(query.to) || dayjs(from).add(30, 'day').toDate();
  if (from >= to) {
    throw new ApiError(400, 'from must be before to', 'VALIDATION_ERROR');
  }

  const effectiveQuery = { ...query, from, to };
  const { baseWhere, membershipInclude } = resolveAccess(user, effectiveQuery);
  const where = applyFilters(baseWhere, effectiveQuery, { includeCursor: false });

  const events = await CalendarEvent.findAll({
    where,
    include: membershipInclude ? [membershipInclude] : [],
    attributes: ['id', 'start_at', 'end_at', 'all_day', 'status'],
    paranoid: true,
  });

  const buckets = Array.from({ length: 24 }, (_, index) => ({
    hour: index.toString().padStart(2, '0'),
    count: 0,
  }));

  const windowStart = dayjs(from);
  const windowEnd = dayjs(to);

  events.forEach((event) => {
    if (event.status === 'cancelled') return;
    const start = dayjs(event.start_at);
    const end = dayjs(event.end_at);
    if (!end.isAfter(start)) return;
    const rangeStart = start.isBefore(windowStart) ? windowStart : start;
    const rangeEnd = end.isAfter(windowEnd) ? windowEnd : end;
    if (!rangeEnd.isAfter(rangeStart)) return;

    if (event.all_day) {
      const startDay = rangeStart.startOf('day');
      const endDay = rangeEnd.startOf('day');
      const daySpan = Math.max(1, endDay.diff(startDay, 'day') + 1);
      for (let dayIndex = 0; dayIndex < daySpan; dayIndex += 1) {
        for (let hour = 0; hour < 24; hour += 1) {
          buckets[hour].count += 1;
        }
      }
      return;
    }

    let cursor = rangeStart;
    while (cursor.isBefore(rangeEnd)) {
      const hour = cursor.hour();
      buckets[hour].count += 1;
      cursor = cursor.add(1, 'hour');
    }
  });

  return {
    from,
    to,
    granularity: 'hour',
    data: buckets,
  };
};

module.exports = {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  getIcsFeed,
  connectIntegration,
  disconnectIntegration,
  busyHoursAnalytics,
};
