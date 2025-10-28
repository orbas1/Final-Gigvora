const { Op } = require('sequelize');
const { LedgerEntry, Wallet, sequelize } = require('../models');
const { ensureWallet } = require('./walletService');
const { buildPagination, encodeCursor } = require('../utils/pagination');

const toNumber = (value) => Number(value || 0);

const listEntries = async (user, query) => {
  const pagination = buildPagination(query, ['occurred_at']);
  const where = {};
  if (query.entity_type) where.entity_type = query.entity_type;
  if (query.entity_id) where.entity_id = query.entity_id;
  if (query.from || query.to) {
    where.occurred_at = {};
    if (query.from) where.occurred_at[Op.gte] = new Date(query.from);
    if (query.to) where.occurred_at[Op.lte] = new Date(query.to);
  }
  let walletId = query.wallet_id;
  if (user.role !== 'admin') {
    const wallet = await ensureWallet(user.id);
    walletId = wallet.id;
  }
  if (walletId) {
    where.wallet_id = walletId;
  }
  const { rows, count } = await LedgerEntry.findAndCountAll({
    where,
    include: [{ model: Wallet, as: 'wallet' }],
    limit: pagination.limit,
    order: pagination.order,
  });
  const nextCursor =
    rows.length === pagination.limit ? encodeCursor(rows[rows.length - 1][pagination.sortField]) : null;
  let analytics;
  if (query.analytics === 'true') {
    const [result] = await LedgerEntry.findAll({
      attributes: [
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN entry_type = 'credit' THEN amount ELSE 0 END")), 'credits'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN entry_type = 'debit' THEN amount ELSE 0 END")), 'debits'],
      ],
      where,
      raw: true,
    });
    analytics = {
      credits: toNumber(result?.credits),
      debits: toNumber(result?.debits),
      net: toNumber(result?.credits) - toNumber(result?.debits),
    };
  }
  return { data: rows, total: count, next_cursor: nextCursor, analytics };
};

module.exports = { listEntries };
