const { Op } = require('sequelize');
const { Wallet, WalletPaymentMethod, WalletPayoutAccount, LedgerEntry, sequelize } = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { buildPagination, encodeCursor } = require('../utils/pagination');

const toNumber = (value) => Number(value || 0);
const likeOperator = sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like;

const ensureWallet = async (userId, { transaction } = {}) => {
  const [wallet] = await Wallet.findOrCreate({
    where: { user_id: userId },
    defaults: {
      currency: 'USD',
    },
    transaction,
  });
  return wallet;
};

const getBalances = async (userId) => {
  const wallet = await ensureWallet(userId);
  return {
    id: wallet.id,
    user_id: wallet.user_id,
    provider: wallet.provider,
    provider_account_id: wallet.provider_account_id,
    currency: wallet.currency,
    available_balance: toNumber(wallet.available_balance),
    pending_balance: toNumber(wallet.pending_balance),
    updated_at: wallet.updated_at,
  };
};

const findMethodOrThrow = async (walletId, methodId, { includeDeleted = false, transaction } = {}) => {
  const method = await WalletPaymentMethod.findOne({
    where: { id: methodId, wallet_id: walletId },
    paranoid: !includeDeleted,
    transaction,
  });
  if (!method) {
    throw new ApiError(404, 'Payment method not found', 'PAYMENT_METHOD_NOT_FOUND');
  }
  return method;
};

const listPaymentMethods = async (walletId, query, { includeDeleted = false } = {}) => {
  const pagination = buildPagination(query, ['created_at']);
  const findOptions = {
    where: { wallet_id: walletId },
    limit: pagination.limit,
    order: pagination.order,
    paranoid: !includeDeleted,
  };
  if (query.q) {
    findOptions.where[Op.or] = [
      { label: { [likeOperator]: `%${query.q}%` } },
      { brand: { [likeOperator]: `%${query.q}%` } },
      { last4: { [Op.like]: `%${query.q}%` } },
    ];
  }
  const { rows, count } = await WalletPaymentMethod.findAndCountAll(findOptions);
  const nextCursor =
    rows.length === pagination.limit ? encodeCursor(rows[rows.length - 1][pagination.sortField]) : null;
  let analytics;
  if (query.analytics === 'true') {
    const active = await WalletPaymentMethod.count({ where: { wallet_id: walletId, status: 'active' } });
    const inactive = await WalletPaymentMethod.count({
      where: { wallet_id: walletId, status: { [Op.ne]: 'active' } },
      paranoid: false,
    });
    analytics = { active, inactive };
  }
  return { data: rows, total: count, next_cursor: nextCursor, analytics };
};

const createPaymentMethod = async (walletId, body) => {
  return sequelize.transaction(async (transaction) => {
    if (body.fingerprint) {
      const existing = await WalletPaymentMethod.scope('withFingerprint').findOne({
        where: { fingerprint: body.fingerprint },
        transaction,
        paranoid: false,
      });
      if (existing && existing.wallet_id === walletId && !existing.deleted_at) {
        throw new ApiError(409, 'Payment method already exists', 'PAYMENT_METHOD_EXISTS');
      }
    }

    if (body.is_default) {
      await WalletPaymentMethod.update(
        { is_default: false },
        { where: { wallet_id: walletId }, transaction }
      );
    }

    const methodCount = await WalletPaymentMethod.count({ where: { wallet_id: walletId }, transaction });
    const isDefault = body.is_default || methodCount === 0;

    const method = await WalletPaymentMethod.create(
      {
        wallet_id: walletId,
        type: body.type,
        label: body.label,
        brand: body.brand,
        last4: body.last4,
        exp_month: body.exp_month,
        exp_year: body.exp_year,
        country: body.country,
        fingerprint: body.fingerprint,
        is_default: isDefault,
        status: body.status || 'active',
        metadata: body.metadata,
      },
      { transaction }
    );

    return method;
  });
};

const deletePaymentMethod = async (walletId, methodId) => {
  return sequelize.transaction(async (transaction) => {
    const method = await findMethodOrThrow(walletId, methodId, { transaction });
    const wasDefault = method.is_default;
    await method.destroy({ transaction });

    if (wasDefault) {
      const nextDefault = await WalletPaymentMethod.findOne({
        where: { wallet_id: walletId },
        order: [['created_at', 'DESC']],
        transaction,
      });
      if (nextDefault) {
        await nextDefault.update({ is_default: true }, { transaction });
      }
    }
    return { success: true };
  });
};

const getPaymentMethod = async (walletId, methodId, { includeDeleted = false } = {}) =>
  findMethodOrThrow(walletId, methodId, { includeDeleted });

const updatePaymentMethod = async (
  walletId,
  methodId,
  updates,
  { allowManageDeleted = false } = {}
) => {
  return sequelize.transaction(async (transaction) => {
    const method = await findMethodOrThrow(walletId, methodId, {
      includeDeleted: allowManageDeleted,
      transaction,
    });
    if (method.deleted_at && !allowManageDeleted) {
      throw new ApiError(404, 'Payment method not found', 'PAYMENT_METHOD_NOT_FOUND');
    }

    const fields = ['label', 'brand', 'last4', 'exp_month', 'exp_year', 'country', 'type'];
    fields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(updates, field)) {
        method[field] = updates[field];
      }
    });

    if (updates.metadata) {
      method.metadata = { ...(method.metadata || {}), ...updates.metadata };
    }

    if (updates.status) {
      method.status = updates.status;
    }

    if (updates.is_default === true && !method.is_default) {
      await WalletPaymentMethod.update(
        { is_default: false },
        { where: { wallet_id: walletId, id: { [Op.ne]: method.id } }, transaction }
      );
      method.is_default = true;
    } else if (updates.is_default === false && method.is_default) {
      method.is_default = false;
      const nextDefault = await WalletPaymentMethod.findOne({
        where: { wallet_id: walletId, id: { [Op.ne]: method.id } },
        order: [['created_at', 'DESC']],
        transaction,
      });
      if (nextDefault) {
        await nextDefault.update({ is_default: true }, { transaction });
      }
    }

    await method.save({ transaction });
    return method;
  });
};

const listPayoutAccounts = async (walletId, query, { includeDeleted = false } = {}) => {
  const pagination = buildPagination(query, ['created_at']);
  const { rows, count } = await WalletPayoutAccount.findAndCountAll({
    where: { wallet_id: walletId },
    limit: pagination.limit,
    order: pagination.order,
    paranoid: !includeDeleted,
  });
  const nextCursor =
    rows.length === pagination.limit ? encodeCursor(rows[rows.length - 1][pagination.sortField]) : null;
  let analytics;
  if (query.analytics === 'true') {
    const verified = await WalletPayoutAccount.count({ where: { wallet_id: walletId, status: 'verified' } });
    const pending = await WalletPayoutAccount.count({ where: { wallet_id: walletId, status: 'pending' }, paranoid: false });
    analytics = { verified, pending };
  }
  return { data: rows, total: count, next_cursor: nextCursor, analytics };
};

const createPayoutAccount = async (walletId, body) => {
  return WalletPayoutAccount.create({
    wallet_id: walletId,
    type: body.type,
    account_holder_name: body.account_holder_name,
    account_identifier_last4: body.account_identifier_last4,
    bank_name: body.bank_name,
    routing_number: body.routing_number,
    currency: body.currency,
    country: body.country,
    status: body.status || 'verified',
    external_account_id: body.external_account_id,
    verified_at: body.verified_at || new Date(),
    metadata: body.metadata,
  });
};

const deletePayoutAccount = async (walletId, payoutAccountId) => {
  const account = await WalletPayoutAccount.findOne({ where: { id: payoutAccountId, wallet_id: walletId } });
  if (!account) {
    throw new ApiError(404, 'Payout account not found', 'PAYOUT_ACCOUNT_NOT_FOUND');
  }
  await account.destroy();
  return { success: true };
};

const findPayoutAccountOrThrow = async (walletId, payoutAccountId, { includeDeleted = false, transaction } = {}) => {
  const account = await WalletPayoutAccount.findOne({
    where: { id: payoutAccountId, wallet_id: walletId },
    paranoid: !includeDeleted,
    transaction,
  });
  if (!account) {
    throw new ApiError(404, 'Payout account not found', 'PAYOUT_ACCOUNT_NOT_FOUND');
  }
  return account;
};

const getPayoutAccount = async (walletId, payoutAccountId, { includeDeleted = false } = {}) =>
  findPayoutAccountOrThrow(walletId, payoutAccountId, { includeDeleted });

const updatePayoutAccount = async (
  walletId,
  payoutAccountId,
  updates,
  { allowManageDeleted = false } = {}
) => {
  return sequelize.transaction(async (transaction) => {
    const account = await findPayoutAccountOrThrow(walletId, payoutAccountId, {
      includeDeleted: allowManageDeleted,
      transaction,
    });
    if (account.deleted_at && !allowManageDeleted) {
      throw new ApiError(404, 'Payout account not found', 'PAYOUT_ACCOUNT_NOT_FOUND');
    }

    const fields = [
      'type',
      'account_holder_name',
      'account_identifier_last4',
      'bank_name',
      'routing_number',
      'currency',
      'country',
      'status',
      'external_account_id',
      'verified_at',
    ];
    const payload = {};
    fields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(updates, field)) {
        payload[field] = updates[field];
      }
    });
    if (updates.metadata) {
      payload.metadata = { ...(account.metadata || {}), ...updates.metadata };
    }

    if (Object.keys(payload).length > 0) {
      await account.update(payload, { transaction });
    }

    return account;
  });
};

const applyLedgerEntry = async (
  wallet,
  { amount, category, entryType, description, entityType, entityId, availableDelta, pendingDelta = 0 },
  transaction
) => {
  const numericAmount = toNumber(amount);
  const currentAvailable = toNumber(wallet.available_balance);
  const currentPending = toNumber(wallet.pending_balance);
  let newAvailable;
  if (availableDelta !== undefined) {
    newAvailable = currentAvailable + toNumber(availableDelta);
  } else if (entryType === 'credit') {
    newAvailable = currentAvailable + numericAmount;
  } else {
    newAvailable = currentAvailable - numericAmount;
  }
  const newPending = currentPending + toNumber(pendingDelta);
  await wallet.update({ available_balance: newAvailable, pending_balance: newPending }, { transaction });
  return LedgerEntry.create(
    {
      wallet_id: wallet.id,
      entity_type: entityType,
      entity_id: entityId,
      entry_type: entryType,
      category,
      amount: numericAmount,
      currency: wallet.currency,
      balance_after: newAvailable,
      description,
      metadata: { pending_balance: newPending },
    },
    { transaction }
  );
};

module.exports = {
  ensureWallet,
  getBalances,
  listPaymentMethods,
  createPaymentMethod,
  getPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  listPayoutAccounts,
  createPayoutAccount,
  getPayoutAccount,
  updatePayoutAccount,
  deletePayoutAccount,
  applyLedgerEntry,
};
