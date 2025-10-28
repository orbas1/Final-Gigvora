const { Op } = require('sequelize');
const { Refund, Wallet, EscrowIntent, sequelize } = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { loadIntent } = require('./escrowService');
const { applyLedgerEntry } = require('./walletService');
const { buildPagination, encodeCursor } = require('../utils/pagination');

const toNumber = (value) => Number(value || 0);

const listRefunds = async (user, query) => {
  const pagination = buildPagination(query, ['created_at']);
  const where = {};
  if (query.escrow_id) where.escrow_id = query.escrow_id;
  if (query.status) where.status = query.status;
  const includeDeleted = query.include === 'deleted' && user.role === 'admin';
  const include = [];
  if (user.role !== 'admin') {
    const wallet = await Wallet.findOne({ where: { user_id: user.id } });
    if (!wallet) {
      return { data: [], total: 0 };
    }
    include.push({
      model: EscrowIntent,
      as: 'escrow',
      required: true,
      where: {
        [Op.or]: [{ payer_wallet_id: wallet.id }, { payee_wallet_id: wallet.id }],
      },
    });
  } else {
    include.push({ model: EscrowIntent, as: 'escrow' });
  }
  const { rows, count } = await Refund.findAndCountAll({
    where,
    include,
    limit: pagination.limit,
    order: pagination.order,
    paranoid: !includeDeleted,
  });
  const nextCursor =
    rows.length === pagination.limit ? encodeCursor(rows[rows.length - 1][pagination.sortField]) : null;
  let analytics;
  if (query.analytics === 'true') {
    const processed = await Refund.count({ where: { status: 'processed' } });
    const pending = await Refund.count({ where: { status: 'pending' } });
    const failed = await Refund.count({ where: { status: 'failed' } });
    analytics = { processed, pending, failed };
  }
  return { data: rows, total: count, next_cursor: nextCursor, analytics };
};

const createRefund = async (user, body, { idempotencyKey } = {}) => {
  if (body.amount <= 0) {
    throw new ApiError(400, 'Amount must be positive', 'VALIDATION_ERROR');
  }
  return sequelize.transaction(async (transaction) => {
    const intent = await loadIntent(body.escrow_id, user, { transaction });
    if (!['captured', 'refunded'].includes(intent.status)) {
      throw new ApiError(409, 'Escrow cannot be refunded', 'ESCROW_INVALID_STATE');
    }
    const remaining = toNumber(intent.captured_amount) - toNumber(intent.refunded_amount);
    if (remaining <= 0) {
      throw new ApiError(400, 'Nothing left to refund', 'ESCROW_NOTHING_TO_REFUND');
    }
    const refundAmount = Math.min(Number(body.amount), remaining);
    const payeeWallet = await intent.getPayeeWallet({ transaction });
    const payerWallet = await intent.getPayerWallet({ transaction });
    if (toNumber(payeeWallet.available_balance) < refundAmount) {
      throw new ApiError(400, 'Payee has insufficient balance', 'INSUFFICIENT_FUNDS');
    }

    await applyLedgerEntry(
      payeeWallet,
      {
        amount: refundAmount,
        category: 'refund_debit',
        entryType: 'debit',
        description: `Refund for escrow ${intent.id}`,
        entityType: 'refund',
        entityId: intent.id,
        availableDelta: -refundAmount,
        pendingDelta: 0,
      },
      transaction
    );

    await applyLedgerEntry(
      payerWallet,
      {
        amount: refundAmount,
        category: 'refund_credit',
        entryType: 'credit',
        description: `Refund received for escrow ${intent.id}`,
        entityType: 'refund',
        entityId: intent.id,
        availableDelta: refundAmount,
        pendingDelta: 0,
      },
      transaction
    );

    intent.refunded_amount = toNumber(intent.refunded_amount) + refundAmount;
    intent.status = intent.refunded_amount >= intent.captured_amount ? 'refunded' : intent.status;
    intent.refunded_at = new Date();
    await intent.save({ transaction });

    const refund = await Refund.create(
      {
        escrow_id: intent.id,
        amount: refundAmount,
        currency: intent.currency,
        status: 'processed',
        reason: body.reason,
        idempotency_key: idempotencyKey,
        processed_at: new Date(),
        metadata: body.metadata,
      },
      { transaction }
    );

    return refund;
  });
};

const getRefund = async (user, id) => {
  const refund = await Refund.findByPk(id, { include: [{ model: EscrowIntent, as: 'escrow' }] });
  if (!refund) {
    throw new ApiError(404, 'Refund not found', 'REFUND_NOT_FOUND');
  }
  // Authorization is handled at loadIntent time, but ensure admin or participant
  if (user.role !== 'admin') {
    const wallet = await Wallet.findOne({ where: { user_id: user.id } });
    if (!wallet) {
      throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
    }
    if (![refund.escrow?.payer_wallet_id, refund.escrow?.payee_wallet_id].includes(wallet.id)) {
      throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
    }
  }
  return refund;
};

const updateRefund = async (user, id, updates) => {
  return sequelize.transaction(async (transaction) => {
    const refund = await Refund.findByPk(id, {
      include: [{ model: EscrowIntent, as: 'escrow' }],
      transaction,
      paranoid: false,
    });
    if (!refund) {
      throw new ApiError(404, 'Refund not found', 'REFUND_NOT_FOUND');
    }
    if (refund.deleted_at && user.role !== 'admin') {
      throw new ApiError(404, 'Refund not found', 'REFUND_NOT_FOUND');
    }

    if (user.role !== 'admin') {
      const wallet = await Wallet.findOne({ where: { user_id: user.id } });
      if (!wallet || ![refund.escrow?.payer_wallet_id, refund.escrow?.payee_wallet_id].includes(wallet.id)) {
        throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
      }
    }

    const patch = {};
    if (Object.prototype.hasOwnProperty.call(updates, 'reason')) {
      patch.reason = updates.reason;
    }
    if (updates.metadata) {
      patch.metadata = { ...(refund.metadata || {}), ...updates.metadata };
    }
    if (updates.processed_at) {
      patch.processed_at = updates.processed_at;
    }

    if (updates.status && updates.status !== refund.status) {
      if (user.role !== 'admin') {
        throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
      }
      if (!['pending', 'processed', 'failed'].includes(updates.status)) {
        throw new ApiError(400, 'Invalid status', 'VALIDATION_ERROR');
      }
      if (['processed', 'failed'].includes(refund.status)) {
        throw new ApiError(409, 'Refund status cannot transition', 'REFUND_INVALID_STATE');
      }
      if (updates.status === 'processed') {
        const intent = await loadIntent(refund.escrow_id, user, { transaction });
        const payeeWallet = await intent.getPayeeWallet({ transaction });
        const payerWallet = await intent.getPayerWallet({ transaction });
        const refundAmount = toNumber(refund.amount);
        if (toNumber(payeeWallet.available_balance) < refundAmount) {
          throw new ApiError(400, 'Payee has insufficient balance', 'INSUFFICIENT_FUNDS');
        }

        await applyLedgerEntry(
          payeeWallet,
          {
            amount: refundAmount,
            category: 'refund_debit',
            entryType: 'debit',
            description: `Refund for escrow ${intent.id}`,
            entityType: 'refund',
            entityId: intent.id,
            availableDelta: -refundAmount,
            pendingDelta: 0,
          },
          transaction
        );

        await applyLedgerEntry(
          payerWallet,
          {
            amount: refundAmount,
            category: 'refund_credit',
            entryType: 'credit',
            description: `Refund received for escrow ${intent.id}`,
            entityType: 'refund',
            entityId: intent.id,
            availableDelta: refundAmount,
            pendingDelta: 0,
          },
          transaction
        );

        intent.refunded_amount = toNumber(intent.refunded_amount) + refundAmount;
        intent.status = intent.refunded_amount >= intent.captured_amount ? 'refunded' : intent.status;
        intent.refunded_at = new Date();
        await intent.save({ transaction });

        patch.processed_at = updates.processed_at || new Date();
      } else if (updates.status === 'failed') {
        patch.processed_at = updates.processed_at || new Date();
      }

      patch.status = updates.status;
    }

    if (Object.keys(patch).length > 0) {
      await refund.update(patch, { transaction });
    }

    await refund.reload({ transaction, include: [{ model: EscrowIntent, as: 'escrow' }], paranoid: false });
    return refund;
  });
};

const deleteRefund = async (user, id) => {
  const refund = await Refund.findByPk(id);
  if (!refund) {
    throw new ApiError(404, 'Refund not found', 'REFUND_NOT_FOUND');
  }
  if (user.role !== 'admin') {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }
  await refund.destroy();
  return { success: true };
};

module.exports = { listRefunds, createRefund, getRefund, updateRefund, deleteRefund };
