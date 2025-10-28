const { Op, UniqueConstraintError } = require('sequelize');
const dayjs = require('dayjs');
const { Connection, User, UserBlock, sequelize } = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { buildPagination, encodeCursor } = require('../utils/pagination');
const { aggregateByPeriod } = require('../utils/analytics');

const CONNECTION_STATUSES = ['pending', 'accepted', 'rejected'];

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseConnectionQueryContext = (currentUser, query = {}, { extraAttributes = [], defaultExpansions = ['requester', 'addressee'] } = {}) => {
  const expandSet = new Set(toArray(query.expand));
  const includeSet = new Set(toArray(query.include));
  const fieldSet = new Set(toArray(query.fields));
  const isAdmin = currentUser?.role === 'admin';
  const paranoid = !(isAdmin && includeSet.has('deleted'));

  let attributes;
  if (fieldSet.size) {
    const attributeList = new Set([...fieldSet]);
    attributeList.add('id');
    attributeList.add('requester_id');
    attributeList.add('addressee_id');
    extraAttributes.filter(Boolean).forEach((attr) => attributeList.add(attr));
    if (!paranoid) {
      attributeList.add('deleted_at');
    }
    attributes = Array.from(attributeList);
  }

  const defaultExpandSet = new Set(defaultExpansions);
  const shouldInclude = (key) => expandSet.has(key) || (!expandSet.size && defaultExpandSet.has(key));
  const include = [];
  if (shouldInclude('requester')) {
    include.push({ ...connectionIncludeConfig[0] });
  }
  if (shouldInclude('addressee')) {
    include.push({ ...connectionIncludeConfig[1] });
  }

  return { include, attributes, paranoid, expandSet, includeSet, fieldSet };
};

const buildConnectionFilters = (query) => {
  const where = {};
  if (query.userId) {
    const direction = String(query.direction || '').toLowerCase();
    if (direction === 'incoming') {
      where.addressee_id = query.userId;
    } else if (direction === 'outgoing') {
      where.requester_id = query.userId;
    } else {
      where[Op.or] = [{ requester_id: query.userId }, { addressee_id: query.userId }];
    }
  }

  if (query.status) {
    const statuses = Array.isArray(query.status)
      ? query.status
      : String(query.status)
          .split(/[|,]/)
          .map((status) => status.trim())
          .filter(Boolean);
    const allowedStatuses = statuses
      .map((status) => status.toLowerCase())
      .filter((status) => CONNECTION_STATUSES.includes(status));
    if (allowedStatuses.length) {
      where.status = { [Op.in]: allowedStatuses };
    }
  }

  if (query.q) {
    const term = `%${String(query.q).toLowerCase()}%`;
    where.note = sequelize.where(sequelize.fn('lower', sequelize.col('note')), {
      [Op.like]: term,
    });
  }

  return where;
};

const basicUserAttributes = ['id', 'email', 'role', 'is_verified'];

const connectionIncludeConfig = [
  { model: User, as: 'requester', attributes: basicUserAttributes },
  { model: User, as: 'addressee', attributes: basicUserAttributes },
];

const wantsAnalytics = (value) => {
  if (value === undefined || value === null) return false;
  const normalized = String(value).toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

const listConnections = async (query, currentUser) => {
  const pagination = buildPagination(query, ['created_at', 'updated_at', 'responded_at']);
  const context = parseConnectionQueryContext(currentUser, query, { extraAttributes: [pagination.sortField] });
  const { include, attributes, paranoid } = context;
  const isAdmin = currentUser?.role === 'admin';

  const normalizedQuery = { ...query };
  let targetUserId = normalizedQuery.userId;

  if (targetUserId) {
    if (!isAdmin && targetUserId !== currentUser?.id) {
      throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
    }
  } else if (!isAdmin) {
    if (!currentUser?.id) {
      throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
    }
    targetUserId = currentUser.id;
    normalizedQuery.userId = targetUserId;
  }

  if (!targetUserId && normalizedQuery.direction) {
    throw new ApiError(400, 'direction filter requires userId', 'INVALID_QUERY');
  }

  const baseFilters = buildConnectionFilters(normalizedQuery);
  const where = { ...baseFilters };

  if (pagination.cursorValue !== undefined) {
    where[pagination.sortField] = {
      ...(where[pagination.sortField] || {}),
      [pagination.cursorOperator]: pagination.cursorValue,
    };
  }

  const { rows, count } = await Connection.findAndCountAll({
    where,
    paranoid,
    include,
    attributes,
    limit: pagination.limit + 1,
    order: pagination.order,
    distinct: true,
  });

  const hasMore = rows.length > pagination.limit;
  const sliced = hasMore ? rows.slice(0, pagination.limit) : rows;
  const data = sliced.map((connection) => connection.toJSON());
  const nextCursorValue = hasMore ? data[data.length - 1]?.[pagination.sortField] : undefined;

  let analytics;
  if (wantsAnalytics(query.analytics)) {
    const paranoidForAnalytics = paranoid;
    const baseFiltersWithoutStatus = { ...baseFilters };
    delete baseFiltersWithoutStatus.status;
    const statusCountsPromise = Connection.findAll({
      where: baseFilters,
      paranoid: paranoidForAnalytics,
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['status'],
      raw: true,
    }).then((rows) => {
      const summary = rows.reduce(
        (acc, row) => {
          const key = row.status || 'unknown';
          const current = acc[key] || 0;
          return { ...acc, [key]: current + Number(row.count) };
        },
        { pending: 0, accepted: 0, rejected: 0 }
      );
      summary.total = Object.entries(summary)
        .filter(([key]) => key !== 'total')
        .reduce((total, [, value]) => total + Number(value || 0), 0);
      return summary;
    });

    const directionCountsPromise = targetUserId
      ? Promise.all([
          Connection.count({
            where: {
              [Op.and]: [baseFiltersWithoutStatus, { requester_id: targetUserId }],
            },
            paranoid: paranoidForAnalytics,
          }),
          Connection.count({
            where: {
              [Op.and]: [baseFiltersWithoutStatus, { addressee_id: targetUserId, status: 'pending' }],
            },
            paranoid: paranoidForAnalytics,
          }),
          Connection.count({
            where: {
              [Op.and]: [
                baseFiltersWithoutStatus,
                {
                  [Op.or]: [
                    { requester_id: targetUserId, status: 'accepted' },
                    { addressee_id: targetUserId, status: 'accepted' },
                  ],
                },
              ],
            },
            paranoid: paranoidForAnalytics,
          }),
        ]).then(([outgoing, incomingPending, accepted]) => ({
          outgoing,
          incoming_pending: incomingPending,
          accepted,
        }))
      : Promise.resolve({});

    const [statusCounts, directionCounts] = await Promise.all([statusCountsPromise, directionCountsPromise]);
    analytics = { ...statusCounts, ...directionCounts };
  }

  const response = {
    data,
    total: typeof count === 'number' ? count : Array.isArray(count) ? count.length : 0,
    page: {
      limit: pagination.limit,
      next_cursor: hasMore && nextCursorValue ? encodeCursor(nextCursorValue) : null,
    },
  };

  if (analytics) {
    response.analytics = analytics;
  }

  return response;
};

const getConnection = async (id, currentUser, query = {}) => {
  const context = parseConnectionQueryContext(currentUser, query);
  const connection = await Connection.findByPk(id, {
    paranoid: context.paranoid,
    include: context.include,
    attributes: context.attributes,
  });

  if (!connection) {
    throw new ApiError(404, 'Connection not found', 'CONNECTION_NOT_FOUND');
  }

  const isParticipant = currentUser && [connection.requester_id, connection.addressee_id].includes(currentUser.id);
  const isAdmin = currentUser?.role === 'admin';

  if (!isParticipant && !isAdmin) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }

  return connection.toJSON();
};

const requestConnection = async (userId, body) => {
  if (userId === body.to_user_id) {
    throw new ApiError(422, 'Cannot send connection request to yourself', 'CONNECTION_SELF_REQUEST');
  }

  return sequelize.transaction(async (transaction) => {
    const [requester, addressee] = await Promise.all([
      User.findByPk(userId, { transaction }),
      User.findByPk(body.to_user_id, { transaction }),
    ]);

    if (!requester) {
      throw new ApiError(404, 'Requester not found', 'REQUESTER_NOT_FOUND');
    }

    if (!addressee) {
      throw new ApiError(404, 'Recipient not found', 'RECIPIENT_NOT_FOUND');
    }

    if (requester.status && requester.status !== 'active') {
      throw new ApiError(403, 'Requester account is not active', 'REQUESTER_INACTIVE');
    }

    if (addressee.status && addressee.status !== 'active') {
      throw new ApiError(403, 'Recipient account is not active', 'RECIPIENT_INACTIVE');
    }

    const existingBlock = await UserBlock.findOne({
      where: {
        [Op.or]: [
          { blocker_id: userId, blocked_id: body.to_user_id },
          { blocker_id: body.to_user_id, blocked_id: userId },
        ],
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (existingBlock) {
      throw new ApiError(403, 'Connection not permitted between blocked users', 'CONNECTION_BLOCKED');
    }

    const existing = await Connection.findOne({
      where: {
        [Op.or]: [
          { requester_id: userId, addressee_id: body.to_user_id },
          { requester_id: body.to_user_id, addressee_id: userId },
        ],
        status: { [Op.in]: ['pending', 'accepted'] },
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
      paranoid: false,
    });

    if (existing && !existing.deleted_at) {
      throw new ApiError(409, 'Connection already exists', 'CONNECTION_EXISTS');
    }

    try {
      const sanitizedNote = body.note === '' || body.note === null ? null : body.note;
      const connection = await Connection.create(
        {
          requester_id: userId,
          addressee_id: body.to_user_id,
          note: sanitizedNote,
          status: 'pending',
        },
        { transaction }
      );

      await connection.reload({ include: connectionIncludeConfig, transaction });
      return connection;
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new ApiError(409, 'Connection already exists', 'CONNECTION_EXISTS');
      }
      throw error;
    }
  });
};

const acceptConnection = async (userId, body) => {
  return sequelize.transaction(async (transaction) => {
    const connection = await Connection.findByPk(body.connection_id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!connection || connection.addressee_id !== userId) {
      throw new ApiError(404, 'Connection not found', 'CONNECTION_NOT_FOUND');
    }
    if (connection.status !== 'pending') {
      throw new ApiError(409, 'Connection already processed', 'CONNECTION_ALREADY_HANDLED');
    }
    connection.status = 'accepted';
    connection.responded_at = new Date();
    await connection.save({ transaction });
    await connection.reload({ include: connectionIncludeConfig, transaction });
    return connection;
  });
};

const rejectConnection = async (userId, body) => {
  return sequelize.transaction(async (transaction) => {
    const connection = await Connection.findByPk(body.connection_id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!connection || connection.addressee_id !== userId) {
      throw new ApiError(404, 'Connection not found', 'CONNECTION_NOT_FOUND');
    }
    if (connection.status !== 'pending') {
      throw new ApiError(409, 'Connection already processed', 'CONNECTION_ALREADY_HANDLED');
    }
    connection.status = 'rejected';
    connection.responded_at = new Date();
    await connection.save({ transaction });
    await connection.reload({ include: connectionIncludeConfig, transaction });
    return connection;
  });
};

const deleteConnection = async (id, currentUser) => {
  return sequelize.transaction(async (transaction) => {
    const connection = await Connection.findByPk(id, { paranoid: false, transaction, lock: transaction.LOCK.UPDATE });
    if (!connection) {
      throw new ApiError(404, 'Connection not found', 'CONNECTION_NOT_FOUND');
    }

    const isParticipant = currentUser && [connection.requester_id, connection.addressee_id].includes(currentUser.id);
    const isAdmin = currentUser?.role === 'admin';

    if (!isParticipant && !isAdmin) {
      throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
    }

    if (connection.deleted_at) {
      if (isAdmin) {
        return { success: true, already_deleted: true };
      }
      throw new ApiError(404, 'Connection not found', 'CONNECTION_NOT_FOUND');
    }

    await connection.destroy({ transaction });
    return { success: true };
  });
};

const updateConnection = async (currentUser, id, updates, query = {}) => {
  const context = parseConnectionQueryContext(currentUser, query);
  return sequelize.transaction(async (transaction) => {
    const connection = await Connection.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
      paranoid: false,
    });

    if (!connection) {
      throw new ApiError(404, 'Connection not found', 'CONNECTION_NOT_FOUND');
    }

    const isParticipant = currentUser && [connection.requester_id, connection.addressee_id].includes(currentUser.id);
    const isAdmin = currentUser?.role === 'admin';

    if (!isParticipant && !isAdmin) {
      throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
    }

    if (connection.deleted_at) {
      if (isAdmin) {
        throw new ApiError(409, 'Cannot update a deleted connection. Restore it first.', 'CONNECTION_DELETED');
      }
      throw new ApiError(404, 'Connection not found', 'CONNECTION_NOT_FOUND');
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'note')) {
      const value = updates.note;
      connection.note = value === '' || value === null ? null : value;
    }

    await connection.save({ transaction });

    const fresh = await Connection.findByPk(connection.id, {
      transaction,
      include: context.include,
      attributes: context.attributes,
      paranoid: context.paranoid,
    });

    return fresh ? fresh.toJSON() : connection.toJSON();
  });
};

const networkGrowthAnalytics = async ({ userId, from, to, by = 'day' }) => {
  if (!userId) {
    throw new ApiError(400, 'userId is required', 'VALIDATION_ERROR');
  }

  const user = await User.findByPk(userId);
  if (!user) {
    throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  }

  const granularity = ['day', 'week', 'month'].includes(by) ? by : 'day';
  const rangeStart = from ? dayjs(from).toDate() : dayjs().subtract(30, 'day').toDate();
  const rangeEnd = to ? dayjs(to).toDate() : new Date();

  return aggregateByPeriod(Connection, 'responded_at', {
    granularity,
    from: rangeStart,
    to: rangeEnd,
    extraWhere: [
      "(status = 'accepted')",
      '(responded_at IS NOT NULL)',
      '(requester_id = :userId OR addressee_id = :userId)',
    ],
    replacements: { userId },
  });
};

module.exports = {
  listConnections,
  getConnection,
  requestConnection,
  acceptConnection,
  rejectConnection,
  deleteConnection,
  updateConnection,
  networkGrowthAnalytics,
};
