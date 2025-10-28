const { Payout, WalletPayoutAccount, Wallet, sequelize } = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { ensureWallet, applyLedgerEntry } = require('./walletService');
const { buildPagination, encodeCursor } = require('../utils/pagination');

const toNumber = (value) => Number(value || 0);

const listPayouts = async (user, query) => {
  const pagination = buildPagination(query, ['created_at']);
  const where = {};
  if (query.status) where.status = query.status;
  if (user.role === 'admin' && query.wallet_id) {
    where.wallet_id = query.wallet_id;
  } else if (user.role !== 'admin') {
    const wallet = await ensureWallet(user.id);
    where.wallet_id = wallet.id;
  }
  const includeDeleted = query.include === 'deleted' && user.role === 'admin';
  const { rows, count } = await Payout.findAndCountAll({
    where,
    include: [{ model: WalletPayoutAccount, as: 'payoutAccount', paranoid: false }],
    limit: pagination.limit,
    order: pagination.order,
    paranoid: !includeDeleted,
  });
  const nextCursor =
    rows.length === pagination.limit ? encodeCursor(rows[rows.length - 1][pagination.sortField]) : null;
  let analytics;
  if (query.analytics === 'true') {
    const processing = await Payout.count({ where: { status: 'processing' } });
    const completed = await Payout.count({ where: { status: 'completed' } });
    analytics = { processing, completed };
  }
  return { data: rows, total: count, next_cursor: nextCursor, analytics };
};

const createPayout = async (user, body, { idempotencyKey } = {}) => {
  if (body.amount <= 0) {
    throw new ApiError(400, 'Amount must be positive', 'VALIDATION_ERROR');
  }
  return sequelize.transaction(async (transaction) => {
    const wallet = await ensureWallet(user.id, { transaction });
    const account = await WalletPayoutAccount.findOne({
      where: { id: body.payout_account_id, wallet_id: wallet.id },
      transaction,
    });
    if (!account) {
      throw new ApiError(404, 'Payout account not found', 'PAYOUT_ACCOUNT_NOT_FOUND');
    }
    if (wallet.currency !== body.currency) {
      throw new ApiError(400, 'Currency mismatch', 'CURRENCY_MISMATCH');
    }
    if (toNumber(wallet.available_balance) < body.amount) {
      throw new ApiError(400, 'Insufficient balance', 'INSUFFICIENT_FUNDS');
    }

    const payout = await Payout.create(
      {
        wallet_id: wallet.id,
        payout_account_id: account.id,
        amount: body.amount,
        currency: body.currency,
        status: 'processing',
        initiated_at: new Date(),
        metadata: body.metadata,
        idempotency_key: idempotencyKey,
      },
      { transaction }
    );

    await applyLedgerEntry(
      wallet,
      {
        amount: body.amount,
        category: 'payout_initiated',
        entryType: 'debit',
        description: `Payout to ${account.type}`,
        entityType: 'payout',
        entityId: payout.id,
        availableDelta: -body.amount,
        pendingDelta: body.amount,
      },
      transaction
    );

    return payout;
  });
};

const getPayout = async (user, id) => {
  const payout = await Payout.findByPk(id, {
    include: [
      { model: WalletPayoutAccount, as: 'payoutAccount', paranoid: false },
      { model: Wallet, as: 'wallet' },
    ],
  });
  if (!payout) {
    throw new ApiError(404, 'Payout not found', 'PAYOUT_NOT_FOUND');
  }
  if (user.role !== 'admin') {
    const wallet = await ensureWallet(user.id);
    if (wallet.id !== payout.wallet_id) {
      throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
    }
  }
  return payout;
};

const finalizePayout = async (
  payout,
  { success, metadata = {}, failure_code, failure_message, processed_at },
  transaction
) => {
  if (payout.status !== 'processing') {
    return payout;
  }
  const wallet = await Wallet.findByPk(payout.wallet_id, { transaction });
  if (!wallet) {
    throw new ApiError(404, 'Wallet not found', 'WALLET_NOT_FOUND');
  }

  payout.status = success ? 'completed' : 'failed';
  payout.processed_at = processed_at || new Date();
  payout.failure_code = success ? null : failure_code || payout.failure_code;
  payout.failure_message = success ? null : failure_message || payout.failure_message;
  payout.metadata = { ...(payout.metadata || {}), ...metadata };
  await payout.save({ transaction });

  const pendingDelta = -toNumber(payout.amount);
  const availableDelta = success ? 0 : toNumber(payout.amount);
  await applyLedgerEntry(
    wallet,
    {
      amount: payout.amount,
      category: success ? 'payout_settled' : 'payout_failed',
      entryType: success ? 'debit' : 'credit',
      description: success ? 'Payout completed' : 'Payout failed refund',
      entityType: 'payout',
      entityId: payout.id,
      availableDelta,
      pendingDelta,
    },
    transaction
  );

  return payout;
};

const updatePayout = async (user, id, updates) => {
  return sequelize.transaction(async (transaction) => {
    const payout = await Payout.findByPk(id, {
      include: [
        { model: WalletPayoutAccount, as: 'payoutAccount', paranoid: false },
        { model: Wallet, as: 'wallet' },
      ],
      transaction,
      paranoid: false,
    });
    if (!payout) {
      throw new ApiError(404, 'Payout not found', 'PAYOUT_NOT_FOUND');
    }

    if (payout.deleted_at && user.role !== 'admin') {
      throw new ApiError(404, 'Payout not found', 'PAYOUT_NOT_FOUND');
    }

    if (user.role !== 'admin') {
      const wallet = await ensureWallet(user.id, { transaction });
      if (wallet.id !== payout.wallet_id) {
        throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
      }
    }

    let metadataMerged = updates.metadata
      ? { ...(payout.metadata || {}), ...updates.metadata }
      : null;

    if (updates.status && updates.status !== payout.status) {
      if (user.role !== 'admin') {
        throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
      }
      if (!['processing', 'completed', 'failed'].includes(updates.status)) {
        throw new ApiError(400, 'Invalid status', 'VALIDATION_ERROR');
      }
      if (['completed', 'failed'].includes(updates.status)) {
        if (payout.status !== 'processing') {
          throw new ApiError(409, 'Payout status cannot transition', 'PAYOUT_INVALID_STATE');
        }
        await finalizePayout(
          payout,
          {
            success: updates.status === 'completed',
            metadata: metadataMerged || {},
            failure_code: updates.failure_code,
            failure_message: updates.failure_message,
            processed_at: updates.processed_at,
          },
          transaction
        );
        metadataMerged = null;
      } else if (updates.status !== payout.status) {
        if (payout.status !== 'processing') {
          throw new ApiError(409, 'Payout status cannot transition', 'PAYOUT_INVALID_STATE');
        }
      }
    }

    const patch = {};
    if (metadataMerged) {
      patch.metadata = metadataMerged;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'failure_code')) {
      patch.failure_code = updates.failure_code;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'failure_message')) {
      patch.failure_message = updates.failure_message;
    }
    if (updates.processed_at && !updates.status && payout.status !== 'processing') {
      patch.processed_at = updates.processed_at;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'status') && updates.status === 'processing') {
      if (payout.status !== 'processing') {
        throw new ApiError(409, 'Payout status cannot transition', 'PAYOUT_INVALID_STATE');
      }
    }

    if (Object.keys(patch).length > 0) {
      await payout.update(patch, { transaction });
    }

    await payout.reload({
      transaction,
      include: [
        { model: WalletPayoutAccount, as: 'payoutAccount', paranoid: false },
        { model: Wallet, as: 'wallet' },
      ],
      paranoid: false,
    });

    return payout;
  });
};

const deletePayout = async (user, id) => {
  const payout = await Payout.findByPk(id, { paranoid: false });
  if (!payout) {
    throw new ApiError(404, 'Payout not found', 'PAYOUT_NOT_FOUND');
  }
  if (user.role !== 'admin') {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }
  if (payout.status === 'processing') {
    throw new ApiError(409, 'Processing payouts cannot be deleted', 'PAYOUT_INVALID_STATE');
  }
  await payout.destroy();
  return { success: true };
};

const markPayoutCompleted = async (payoutId, success = true, metadata = {}) => {
  return sequelize.transaction(async (transaction) => {
    const payout = await Payout.findByPk(payoutId, { transaction });
    if (!payout) {
      throw new ApiError(404, 'Payout not found', 'PAYOUT_NOT_FOUND');
    }
    await finalizePayout(payout, { success, metadata }, transaction);
    return payout;
  });
};

module.exports = {
  listPayouts,
  createPayout,
  getPayout,
  updatePayout,
  deletePayout,
  markPayoutCompleted,
};
