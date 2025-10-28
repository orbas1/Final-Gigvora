const { Op } = require('sequelize');
const { Connection, User } = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { buildPagination } = require('../utils/pagination');
const { aggregateByPeriod } = require('../utils/analytics');

const listConnections = async (query) => {
  const pagination = buildPagination(query);
  const where = {};
  if (query.userId) {
    where[Op.or] = [{ requester_id: query.userId }, { addressee_id: query.userId }];
  }
  if (query.status) where.status = query.status;
  const { rows, count } = await Connection.findAndCountAll({
    where,
    include: [
      { model: User, as: 'requester' },
      { model: User, as: 'addressee' },
    ],
    limit: pagination.limit,
    order: pagination.order,
  });
  return { data: rows, total: count };
};

const requestConnection = async (userId, body) => {
  const existing = await Connection.findOne({ where: { requester_id: userId, addressee_id: body.to_user_id } });
  if (existing) {
    throw new ApiError(409, 'Connection already exists', 'CONNECTION_EXISTS');
  }
  return Connection.create({ requester_id: userId, addressee_id: body.to_user_id, note: body.note });
};

const acceptConnection = async (userId, body) => {
  const connection = await Connection.findByPk(body.connection_id);
  if (!connection || connection.addressee_id !== userId) {
    throw new ApiError(404, 'Connection not found', 'CONNECTION_NOT_FOUND');
  }
  connection.status = 'accepted';
  connection.responded_at = new Date();
  await connection.save();
  return connection;
};

const rejectConnection = async (userId, body) => {
  const connection = await Connection.findByPk(body.connection_id);
  if (!connection || connection.addressee_id !== userId) {
    throw new ApiError(404, 'Connection not found', 'CONNECTION_NOT_FOUND');
  }
  connection.status = 'rejected';
  connection.responded_at = new Date();
  await connection.save();
  return connection;
};

const deleteConnection = async (id, userId) => {
  const connection = await Connection.findByPk(id);
  if (!connection || (connection.requester_id !== userId && connection.addressee_id !== userId)) {
    throw new ApiError(404, 'Connection not found', 'CONNECTION_NOT_FOUND');
  }
  await connection.destroy();
  return { success: true };
};

const networkGrowthAnalytics = async ({ userId, from, to, by = 'day' }) => {
  if (!userId) {
    throw new ApiError(400, 'userId is required', 'VALIDATION_ERROR');
  }

  const granularity = ['day', 'week', 'month'].includes(by) ? by : 'day';
  const rangeStart = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rangeEnd = to || new Date();

  return aggregateByPeriod(Connection, 'created_at', {
    granularity,
    from: rangeStart,
    to: rangeEnd,
    extraWhere: ['(requester_id = :userId OR addressee_id = :userId)'],
    replacements: { userId },
  });
};

module.exports = {
  listConnections,
  requestConnection,
  acceptConnection,
  rejectConnection,
  deleteConnection,
  networkGrowthAnalytics,
};
