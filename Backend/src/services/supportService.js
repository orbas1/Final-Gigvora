'use strict';

const dayjs = require('dayjs');
const { Op } = require('sequelize');
const { SupportTicket, SupportMessage, User, sequelize } = require('../models');
const { buildPagination, encodeCursor } = require('../utils/pagination');
const { ApiError } = require('../middleware/errorHandler');

const STATUS_VALUES = ['open', 'pending', 'closed'];
const PRIORITY_VALUES = ['low', 'normal', 'high'];

const canAdminister = (user) => Boolean(user && user.role === 'admin');

const toBoolean = (value) => value === true || value === 'true' || value === 1 || value === '1';

const splitQueryValues = (value) =>
  new Set(
    String(value || '')
      .split(',')
      .map((segment) => segment.trim())
      .filter(Boolean)
  );

const buildDiffExpression = (dialect, start, end) => {
  switch (dialect) {
    case 'mysql':
    case 'mariadb':
      return `CASE WHEN ${start} IS NULL OR ${end} IS NULL THEN NULL ELSE TIMESTAMPDIFF(MINUTE, ${start}, ${end}) END`;
    case 'sqlite':
      return `CASE WHEN ${start} IS NULL OR ${end} IS NULL THEN NULL ELSE ((JULIANDAY(${end}) - JULIANDAY(${start})) * 1440.0) END`;
    default:
      return `CASE WHEN ${start} IS NULL OR ${end} IS NULL THEN NULL ELSE EXTRACT(EPOCH FROM (${end} - ${start})) / 60.0 END`;
  }
};

const formatBucketLabel = (dialect, granularity, value) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    const iso = value.toISOString();
    if (granularity === 'month') {
      return iso.slice(0, 7);
    }
    if (granularity === 'day') {
      return iso.slice(0, 10);
    }
    return iso;
  }

  if (typeof value === 'number') {
    if (dialect === 'sqlite') {
      return dayjs(value * 1000).toISOString();
    }
    return String(value);
  }

  if (typeof value === 'string') {
    return value;
  }

  return String(value);
};

const bucketExpressionForAlias = (dialect, alias, column, granularity) => {
  const qualified = `${alias}."${column}"`;
  switch (granularity) {
    case 'month':
      if (dialect === 'mysql' || dialect === 'mariadb') {
        return `DATE_FORMAT(${qualified}, '%Y-%m')`;
      }
      if (dialect === 'sqlite') {
        return `strftime('%Y-%m', ${qualified})`;
      }
      return `DATE_TRUNC('month', ${qualified})`;
    case 'week':
      if (dialect === 'mysql' || dialect === 'mariadb') {
        return `DATE_FORMAT(${qualified}, '%x-%v')`;
      }
      if (dialect === 'sqlite') {
        return `strftime('%Y-%W', ${qualified})`;
      }
      return `DATE_TRUNC('week', ${qualified})`;
    case 'day':
    default:
      if (dialect === 'mysql' || dialect === 'mariadb') {
        return `DATE_FORMAT(${qualified}, '%Y-%m-%d')`;
      }
      if (dialect === 'sqlite') {
        return `strftime('%Y-%m-%d', ${qualified})`;
      }
      return `DATE_TRUNC('day', ${qualified})`;
  }
};

const normalizeSearchValue = (value) => `%${String(value || '').trim()}%`;

const buildTicketFilters = (query, currentUser) => {
  if (!currentUser) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  const pagination = buildPagination(query, ['created_at', 'updated_at']);
  const includeSet = splitQueryValues(query.include);
  const expandSet = splitQueryValues(query.expand);
  const fieldSet = splitQueryValues(query.fields);
  const includeDeleted = includeSet.has('deleted') && canAdminister(currentUser);

  const where = {};
  const rawConditions = [];
  const replacements = {};

  if (canAdminister(currentUser)) {
    if (query.user_id) {
      where.user_id = query.user_id;
      rawConditions.push('t.user_id = :filterUserId');
      replacements.filterUserId = query.user_id;
    }
  } else {
    where.user_id = currentUser.id;
    rawConditions.push('t.user_id = :filterUserId');
    replacements.filterUserId = currentUser.id;
  }

  if (query.status && STATUS_VALUES.includes(query.status)) {
    where.status = query.status;
    rawConditions.push('t.status = :status');
    replacements.status = query.status;
  }

  if (query.priority && PRIORITY_VALUES.includes(query.priority)) {
    where.priority = query.priority;
    rawConditions.push('t.priority = :priority');
    replacements.priority = query.priority;
  }

  if (query.q) {
    const search = normalizeSearchValue(query.q);
    const dialect = SupportTicket.sequelize.getDialect();
    const comparator = dialect === 'postgres' ? Op.iLike : Op.like;
    where.subject = { [comparator]: search };
    if (dialect === 'postgres') {
      rawConditions.push('t.subject ILIKE :search');
    } else {
      rawConditions.push('t.subject LIKE :search');
    }
    replacements.search = search;
  }

  if (pagination.cursorValue !== undefined) {
    const operator = pagination.cursorOperator === Op.lt ? '<' : '>';
    const parameter = pagination.cursorValue instanceof Date ? pagination.cursorValue : pagination.cursorValue;
    where[pagination.sortField] = { [pagination.cursorOperator]: pagination.cursorValue };
    rawConditions.push(`t.${pagination.sortField} ${operator} :cursor`);
    replacements.cursor = parameter;
  }

  return {
    pagination,
    where,
    includeDeleted,
    expandSet,
    fieldSet,
    rawConditions,
    replacements,
  };
};

const serializeTicket = (ticket) => {
  const plain = ticket.toJSON();
  if (plain.messages) {
    plain.messages = plain.messages
      .map((message) => ({ ...message, created_at: new Date(message.created_at) }))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }
  return plain;
};

const computeTicketAnalytics = async ({ rawConditions, replacements, includeDeleted }) => {
  const queryInterface = sequelize.getQueryInterface();
  const generator = queryInterface.queryGenerator;
  const ticketTable = generator.quoteTable(SupportTicket.getTableName());
  const messageTable = generator.quoteTable(SupportMessage.getTableName());
  const userTable = generator.quoteTable(User.getTableName());
  const col = (alias, column) => `${alias}.${generator.quoteIdentifier(column)}`;
  const dialect = sequelize.getDialect();

  const whereClause = rawConditions.length ? `AND ${rawConditions.join(' AND ')}` : '';
  const deletedClause = includeDeleted ? '' : `AND ${col('t', 'deleted_at')} IS NULL`;

  const firstResponseSubquery = `(
    SELECT MIN(${col('sm', 'created_at')})
    FROM ${messageTable} sm
    LEFT JOIN ${userTable} u ON ${col('u', 'id')} = ${col('sm', 'user_id')}
    WHERE ${col('sm', 'ticket_id')} = ${col('t', 'id')}
      AND (
        ${col('sm', 'user_id')} IS NULL OR
        ${col('sm', 'user_id')} <> ${col('t', 'user_id')} OR
        ${col('u', 'role')} = 'admin'
      )
  )`;

  const baseSubquery = `
    SELECT
      ${col('t', 'id')} AS id,
      ${col('t', 'status')} AS status,
      ${col('t', 'created_at')} AS created_at,
      ${col('t', 'updated_at')} AS updated_at,
      ${firstResponseSubquery} AS first_response_at,
      CASE WHEN ${col('t', 'status')} = 'closed' THEN ${col('t', 'updated_at')} ELSE NULL END AS resolution_at
    FROM ${ticketTable} t
    WHERE 1=1 ${deletedClause} ${whereClause}
  `;

  const diffFirstResponse = buildDiffExpression(dialect, 'base.created_at', 'base.first_response_at');
  const diffResolution = buildDiffExpression(dialect, 'base.created_at', 'base.resolution_at');

  const summaryQuery = `
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN base.status = 'open' THEN 1 ELSE 0 END) AS open_count,
      SUM(CASE WHEN base.status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
      SUM(CASE WHEN base.status = 'closed' THEN 1 ELSE 0 END) AS closed_count,
      AVG(${diffFirstResponse}) AS avg_first_response,
      AVG(${diffResolution}) AS avg_resolution
    FROM (${baseSubquery}) base
  `;

  const [summary] = await sequelize.query(summaryQuery, {
    replacements,
    type: sequelize.QueryTypes.SELECT,
  });

  return {
    totals: {
      total: Number(summary?.total || 0),
      open: Number(summary?.open_count || 0),
      pending: Number(summary?.pending_count || 0),
      closed: Number(summary?.closed_count || 0),
    },
    average_first_response_minutes:
      summary?.avg_first_response === null || summary?.avg_first_response === undefined
        ? null
        : Number(summary.avg_first_response),
    average_resolution_minutes:
      summary?.avg_resolution === null || summary?.avg_resolution === undefined
        ? null
        : Number(summary.avg_resolution),
  };
};

const listTickets = async (query, currentUser) => {
  const {
    pagination,
    where,
    includeDeleted,
    expandSet,
    fieldSet,
    rawConditions,
    replacements,
  } = buildTicketFilters(query, currentUser);

  const include = [];
  const includeUser = expandSet.has('user') || canAdminister(currentUser);
  const includeMessages = expandSet.has('messages');

  if (includeUser) {
    include.push({ association: 'user', attributes: ['id', 'email', 'role'] });
  }

  if (includeMessages) {
    const messageInclude = {
      association: 'messages',
      separate: true,
      order: [['created_at', 'ASC']],
      attributes: ['id', 'ticket_id', 'user_id', 'body', 'created_at', 'updated_at'],
    };
    messageInclude.include = [
      {
        association: 'user',
        attributes: ['id', 'email', 'role'],
        required: false,
      },
    ];
    include.push(messageInclude);
  }

  let attributes;
  if (fieldSet.size) {
    attributes = Array.from(fieldSet).filter((field) =>
      ['id', 'user_id', 'status', 'subject', 'priority', 'created_at', 'updated_at', 'deleted_at'].includes(field)
    );
    if (!attributes.includes(pagination.sortField)) {
      attributes.push(pagination.sortField);
    }
    if (includeDeleted && !attributes.includes('deleted_at')) {
      attributes.push('deleted_at');
    }
  }

  const tickets = await SupportTicket.findAll({
    where,
    include,
    order: pagination.order,
    limit: pagination.limit + 1,
    paranoid: !includeDeleted,
    attributes,
  });

  const hasMore = tickets.length > pagination.limit;
  const limited = hasMore ? tickets.slice(0, pagination.limit) : tickets;
  const data = limited.map(serializeTicket);

  const response = {
    data,
    page_size: pagination.limit,
    next_cursor: hasMore ? encodeCursor(limited[limited.length - 1].get(pagination.sortField)) : null,
  };

  if (toBoolean(query.analytics)) {
    response.analytics = await computeTicketAnalytics({ rawConditions, replacements, includeDeleted });
  }

  return response;
};

const getTicketById = async (id, currentUser, { includeDeleted = false, expandSet = new Set() } = {}) => {
  const include = [];
  const includeUser = expandSet.has('user') || canAdminister(currentUser);
  const includeMessages = expandSet.has('messages');

  if (includeUser) {
    include.push({ association: 'user', attributes: ['id', 'email', 'role'] });
  }
  if (includeMessages) {
    include.push({
      association: 'messages',
      separate: true,
      order: [['created_at', 'ASC']],
      include: [
        {
          association: 'user',
          attributes: ['id', 'email', 'role'],
          required: false,
        },
      ],
    });
  }

  const scopedModel = includeDeleted ? SupportTicket.scope('withDeleted') : SupportTicket;
  const ticket = await scopedModel.findByPk(id, { include });
  if (!ticket) {
    return null;
  }

  if (!canAdminister(currentUser) && ticket.user_id !== currentUser.id) {
    throw new ApiError(403, 'You do not have access to this ticket', 'FORBIDDEN');
  }

  return serializeTicket(ticket);
};

const createTicket = async (currentUser, body) => {
  if (!body.subject || !body.subject.trim()) {
    throw new ApiError(400, 'Subject is required', 'VALIDATION_ERROR');
  }

  if (body.priority && !PRIORITY_VALUES.includes(body.priority)) {
    throw new ApiError(400, 'Invalid priority', 'VALIDATION_ERROR');
  }

  return sequelize.transaction(async (transaction) => {
    const ticket = await SupportTicket.create(
      {
        user_id: currentUser.id,
        subject: body.subject.trim(),
        status: 'open',
        priority: body.priority || 'normal',
      },
      { transaction }
    );

    if (body.message) {
      await SupportMessage.create(
        {
          ticket_id: ticket.id,
          user_id: currentUser.id,
          body: body.message,
        },
        { transaction }
      );
    }

    return getTicketById(ticket.id, currentUser, {
      expandSet: new Set(['messages', 'user']),
      includeDeleted: false,
    });
  });
};

const getTicket = (id, currentUser, query = {}) => {
  const expandSet = splitQueryValues(query.expand || 'messages,user');
  const includeSet = splitQueryValues(query.include);
  const includeDeleted = includeSet.has('deleted') && canAdminister(currentUser);
  return getTicketById(id, currentUser, { expandSet, includeDeleted });
};

const ensureTicketForUpdate = async (id, currentUser) => {
  const ticket = await SupportTicket.scope('withDeleted').findByPk(id);
  if (!ticket) {
    throw new ApiError(404, 'Ticket not found', 'TICKET_NOT_FOUND');
  }
  if (!canAdminister(currentUser) && ticket.user_id !== currentUser.id) {
    throw new ApiError(403, 'You do not have access to this ticket', 'FORBIDDEN');
  }
  if (ticket.deleted_at) {
    throw new ApiError(410, 'Ticket has been deleted', 'TICKET_DELETED');
  }
  return ticket;
};

const updateTicket = async (id, body, currentUser) => {
  const ticket = await ensureTicketForUpdate(id, currentUser);

  const updates = {};
  if (body.status) {
    if (!STATUS_VALUES.includes(body.status)) {
      throw new ApiError(400, 'Invalid status', 'VALIDATION_ERROR');
    }
    updates.status = body.status;
  }

  if (body.priority) {
    if (!PRIORITY_VALUES.includes(body.priority)) {
      throw new ApiError(400, 'Invalid priority', 'VALIDATION_ERROR');
    }
    updates.priority = body.priority;
  }

  if (body.subject) {
    const trimmed = body.subject.trim();
    if (!trimmed) {
      throw new ApiError(400, 'Subject cannot be empty', 'VALIDATION_ERROR');
    }
    updates.subject = trimmed;
  }

  if (!Object.keys(updates).length) {
    return getTicketById(id, currentUser, { expandSet: splitQueryValues('messages,user') });
  }

  if (!canAdminister(currentUser) && updates.status && updates.status !== ticket.status) {
    throw new ApiError(403, 'Only administrators can change ticket status', 'FORBIDDEN');
  }

  await ticket.update(updates);

  return getTicketById(id, currentUser, { expandSet: splitQueryValues('messages,user') });
};

const addMessage = async (currentUser, id, body) => {
  const ticket = await ensureTicketForUpdate(id, currentUser);
  if (ticket.status === 'closed') {
    throw new ApiError(409, 'Cannot add messages to a closed ticket', 'TICKET_CLOSED');
  }

  const message = await SupportMessage.create({
    ticket_id: ticket.id,
    user_id: currentUser.id,
    body: body.message,
  });

  const created = await SupportMessage.findByPk(message.id, {
    include: [{ association: 'user', attributes: ['id', 'email', 'role'] }],
  });

  return created.toJSON();
};

const slaAnalytics = async ({ from, to, by = 'day' }, currentUser) => {
  if (!canAdminister(currentUser)) {
    throw new ApiError(403, 'Administrator privileges are required for analytics', 'FORBIDDEN');
  }

  const rawConditions = [];
  const replacements = {};

  if (from) {
    const fromDate = new Date(from);
    if (Number.isNaN(fromDate.valueOf())) {
      throw new ApiError(400, 'Invalid from date', 'VALIDATION_ERROR');
    }
    rawConditions.push('t.created_at >= :from');
    replacements.from = fromDate;
  }

  if (to) {
    const toDate = new Date(to);
    if (Number.isNaN(toDate.valueOf())) {
      throw new ApiError(400, 'Invalid to date', 'VALIDATION_ERROR');
    }
    rawConditions.push('t.created_at <= :to');
    replacements.to = toDate;
  }

  const summary = await computeTicketAnalytics({ rawConditions, replacements, includeDeleted: false });

  const queryInterface = sequelize.getQueryInterface();
  const generator = queryInterface.queryGenerator;
  const ticketTable = generator.quoteTable(SupportTicket.getTableName());
  const messageTable = generator.quoteTable(SupportMessage.getTableName());
  const userTable = generator.quoteTable(User.getTableName());
  const col = (alias, column) => `${alias}.${generator.quoteIdentifier(column)}`;
  const dialect = sequelize.getDialect();

  const whereClause = rawConditions.length ? `AND ${rawConditions.join(' AND ')}` : '';
  const firstResponseSubquery = `(
    SELECT MIN(${col('sm', 'created_at')})
    FROM ${messageTable} sm
    LEFT JOIN ${userTable} u ON ${col('u', 'id')} = ${col('sm', 'user_id')}
    WHERE ${col('sm', 'ticket_id')} = ${col('t', 'id')}
      AND (
        ${col('sm', 'user_id')} IS NULL OR
        ${col('sm', 'user_id')} <> ${col('t', 'user_id')} OR
        ${col('u', 'role')} = 'admin'
      )
  )`;

  const baseSubquery = `
    SELECT
      ${col('t', 'id')} AS id,
      ${col('t', 'status')} AS status,
      ${col('t', 'created_at')} AS created_at,
      ${col('t', 'updated_at')} AS updated_at,
      ${firstResponseSubquery} AS first_response_at,
      CASE WHEN ${col('t', 'status')} = 'closed' THEN ${col('t', 'updated_at')} ELSE NULL END AS resolution_at
    FROM ${ticketTable} t
    WHERE ${col('t', 'deleted_at')} IS NULL ${whereClause}
  `;

  const bucketExpression = bucketExpressionForAlias(dialect, 'base', 'created_at', by);
  const diffFirst = buildDiffExpression(dialect, 'base.created_at', 'base.first_response_at');
  const diffResolution = buildDiffExpression(dialect, 'base.created_at', 'base.resolution_at');

  const bucketQuery = `
    SELECT
      ${bucketExpression} AS bucket,
      COUNT(*) AS total,
      AVG(${diffFirst}) AS avg_first_response,
      AVG(${diffResolution}) AS avg_resolution
    FROM (${baseSubquery}) base
    GROUP BY bucket
    ORDER BY bucket ASC
  `;

  const rows = await sequelize.query(bucketQuery, {
    replacements,
    type: sequelize.QueryTypes.SELECT,
  });

  const buckets = rows.map((row) => ({
    bucket: formatBucketLabel(dialect, by, row.bucket),
    total: Number(row.total || 0),
    average_first_response_minutes:
      row.avg_first_response === null || row.avg_first_response === undefined
        ? null
        : Number(row.avg_first_response),
    average_resolution_minutes:
      row.avg_resolution === null || row.avg_resolution === undefined
        ? null
        : Number(row.avg_resolution),
  }));

  return {
    from: from ? new Date(from) : null,
    to: to ? new Date(to) : null,
    granularity: by,
    summary,
    buckets,
  };
};

const deleteTicket = async (id, currentUser, { force = false } = {}) => {
  const ticket = await SupportTicket.scope('withDeleted').findByPk(id);
  if (!ticket) {
    throw new ApiError(404, 'Ticket not found', 'TICKET_NOT_FOUND');
  }

  const isAdmin = canAdminister(currentUser);
  if (!isAdmin && ticket.user_id !== currentUser.id) {
    throw new ApiError(403, 'You do not have access to this ticket', 'FORBIDDEN');
  }

  if (force && !isAdmin) {
    throw new ApiError(403, 'Only administrators can force delete tickets', 'FORBIDDEN');
  }

  if (ticket.deleted_at) {
    if (force && isAdmin) {
      await SupportTicket.destroy({ where: { id }, force: true });
    }
    return { success: true, deleted: true };
  }

  return sequelize.transaction(async (transaction) => {
    if (ticket.status !== 'closed') {
      await ticket.update({ status: 'closed' }, { transaction });
    }

    await ticket.destroy({ transaction, force: force && isAdmin });

    return { success: true, deleted: true };
  });
};

const restoreTicket = async (id, currentUser) => {
  if (!canAdminister(currentUser)) {
    throw new ApiError(403, 'Administrator privileges are required to restore tickets', 'FORBIDDEN');
  }

  const [restored] = await SupportTicket.restore({ where: { id } });
  if (!restored) {
    throw new ApiError(404, 'Ticket not found or not deleted', 'TICKET_NOT_FOUND');
  }

  return getTicketById(id, currentUser, { expandSet: splitQueryValues('messages,user') });
};

module.exports = {
  listTickets,
  createTicket,
  getTicket,
  addMessage,
  updateTicket,
  slaAnalytics,
  deleteTicket,
  restoreTicket,
};
