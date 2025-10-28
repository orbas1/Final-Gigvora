const { Op } = require('sequelize');
const { Invoice, Wallet } = require('../models');
const { ensureWallet } = require('./walletService');
const { ApiError } = require('../middleware/errorHandler');
const { buildPagination, encodeCursor } = require('../utils/pagination');

const toNumber = (value) => Number(value || 0);

const listInvoices = async (user, query) => {
  const pagination = buildPagination(query, ['issued_at']);
  const where = {};
  if (query.entity_type) where.entity_type = query.entity_type;
  if (query.entity_id) where.entity_id = query.entity_id;
  if (query.from || query.to) {
    where.issued_at = {};
    if (query.from) where.issued_at[Op.gte] = new Date(query.from);
    if (query.to) where.issued_at[Op.lte] = new Date(query.to);
  }
  let walletId = query.wallet_id;
  if (user.role !== 'admin') {
    const wallet = await ensureWallet(user.id);
    walletId = wallet.id;
  }
  if (walletId) {
    where[Op.or] = [{ wallet_id: walletId }, { wallet_id: null }];
  }
  const includeDeleted = query.include === 'deleted' && user.role === 'admin';
  const { rows, count } = await Invoice.findAndCountAll({
    where,
    include: [{ model: Wallet, as: 'wallet' }],
    limit: pagination.limit,
    order: pagination.order,
    paranoid: !includeDeleted,
  });
  const nextCursor =
    rows.length === pagination.limit ? encodeCursor(rows[rows.length - 1][pagination.sortField]) : null;
  let analytics;
  if (query.analytics === 'true') {
    const [amountDue, amountPaid] = await Promise.all([
      Invoice.sum('amount_due', { where }),
      Invoice.sum('amount_paid', { where }),
    ]);
    analytics = { amount_due: toNumber(amountDue), amount_paid: toNumber(amountPaid) };
  }
  return { data: rows, total: count, next_cursor: nextCursor, analytics };
};

const getInvoice = async (user, id) => {
  const invoice = await Invoice.findByPk(id, { include: [{ model: Wallet, as: 'wallet' }] });
  if (!invoice) {
    throw new ApiError(404, 'Invoice not found', 'INVOICE_NOT_FOUND');
  }
  if (user.role !== 'admin') {
    const wallet = await ensureWallet(user.id);
    if (invoice.wallet_id && invoice.wallet_id !== wallet.id) {
      throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
    }
  }
  return invoice;
};

module.exports = { listInvoices, getInvoice };
