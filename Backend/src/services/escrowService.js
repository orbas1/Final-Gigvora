const { Op } = require('sequelize');
const { EscrowIntent, Refund, Wallet, Invoice, sequelize } = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { ensureWallet, applyLedgerEntry } = require('./walletService');
const { encodeCursor, buildPagination } = require('../utils/pagination');

const FEE_RATE = Number(process.env.PAYMENTS_PLATFORM_FEE || 0.05);

const toNumber = (value) => Number(value || 0);

const loadIntent = async (id, user, { transaction } = {}) => {
  const intent = await EscrowIntent.findByPk(id, {
    include: [
      { model: Wallet, as: 'payerWallet' },
      { model: Wallet, as: 'payeeWallet' },
      { model: Refund, as: 'refunds' },
    ],
    transaction,
  });
  if (!intent) {
    throw new ApiError(404, 'Escrow intent not found', 'ESCROW_NOT_FOUND');
  }
  if (user.role !== 'admin') {
    const payerUserId = intent.payerWallet?.user_id;
    const payeeUserId = intent.payeeWallet?.user_id;
    if (![payerUserId, payeeUserId].includes(user.id)) {
      throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
    }
  }
  return intent;
};

const createIntent = async (user, body, { idempotencyKey } = {}) => {
  if (body.amount <= 0) {
    throw new ApiError(400, 'Amount must be positive', 'VALIDATION_ERROR');
  }
  return sequelize.transaction(async (transaction) => {
    const payerWallet = await ensureWallet(user.id, { transaction });
    const payeeWallet = await ensureWallet(body.payee_user_id, { transaction });

    if (payerWallet.currency !== body.currency || payeeWallet.currency !== body.currency) {
      throw new ApiError(400, 'Currency mismatch', 'CURRENCY_MISMATCH');
    }

    if (toNumber(payerWallet.available_balance) < body.amount) {
      throw new ApiError(400, 'Insufficient balance', 'INSUFFICIENT_FUNDS');
    }

    const intent = await EscrowIntent.create(
      {
        reference_type: body.reference_type,
        reference_id: body.reference_id,
        payer_wallet_id: payerWallet.id,
        payee_wallet_id: payeeWallet.id,
        amount: body.amount,
        currency: body.currency,
        status: 'authorized',
        metadata: body.metadata,
        idempotency_key: idempotencyKey,
      },
      { transaction }
    );

    await applyLedgerEntry(
      payerWallet,
      {
        amount: body.amount,
        category: 'escrow_authorize',
        entryType: 'debit',
        description: `Escrow authorization for ${body.reference_type} ${body.reference_id}`,
        entityType: 'escrow',
        entityId: intent.id,
        availableDelta: -body.amount,
        pendingDelta: body.amount,
      },
      transaction
    );

    return intent;
  });
};

const captureIntent = async (user, id, body = {}, { idempotencyKey } = {}) => {
  const amountRequested = body.amount;
  return sequelize.transaction(async (transaction) => {
    const intent = await loadIntent(id, user, { transaction });
    if (!['authorized', 'held'].includes(intent.status)) {
      throw new ApiError(409, 'Escrow cannot be captured', 'ESCROW_INVALID_STATE');
    }
    const payerWallet = await intent.getPayerWallet({ transaction });
    const payeeWallet = await intent.getPayeeWallet({ transaction });
    const remaining = toNumber(intent.amount) - toNumber(intent.captured_amount);
    const captureAmount = amountRequested ? Math.min(remaining, Number(amountRequested)) : remaining;
    if (captureAmount <= 0) {
      throw new ApiError(400, 'Nothing left to capture', 'ESCROW_NOTHING_TO_CAPTURE');
    }

    const feeAmount = Number((captureAmount * FEE_RATE).toFixed(2));
    const netAmount = captureAmount - feeAmount;

    await applyLedgerEntry(
      payerWallet,
      {
        amount: captureAmount,
        category: 'escrow_capture',
        entryType: 'debit',
        description: `Escrow capture for ${intent.reference_type} ${intent.reference_id}`,
        entityType: 'escrow',
        entityId: intent.id,
        availableDelta: 0,
        pendingDelta: -captureAmount,
      },
      transaction
    );

    await applyLedgerEntry(
      payeeWallet,
      {
        amount: netAmount,
        category: 'escrow_release',
        entryType: 'credit',
        description: `Escrow release from ${intent.reference_type} ${intent.reference_id}`,
        entityType: 'escrow',
        entityId: intent.id,
        availableDelta: netAmount,
        pendingDelta: 0,
      },
      transaction
    );

    intent.captured_amount = toNumber(intent.captured_amount) + captureAmount;
    intent.fee_amount = toNumber(intent.fee_amount) + feeAmount;
    intent.status = intent.captured_amount >= intent.amount ? 'captured' : 'authorized';
    intent.captured_at = new Date();
    intent.is_on_hold = false;
    intent.released_at = new Date();
    intent.metadata = {
      ...(intent.metadata || {}),
      last_capture_idempotency_key: idempotencyKey,
    };
    await intent.save({ transaction });

    await Invoice.findOrCreate({
      where: { entity_type: 'escrow', entity_id: intent.id },
      defaults: {
        wallet_id: payeeWallet.id,
        number: `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        currency: intent.currency,
        amount_due: netAmount,
        amount_paid: netAmount,
        status: 'paid',
        issued_at: new Date(),
        paid_at: new Date(),
        pdf_url: `https://cdn.gigvora.test/invoices/${intent.id}.pdf`,
        metadata: { escrow_id: intent.id, reference_type: intent.reference_type },
      },
      transaction,
    });

    return intent;
  });
};

const cancelIntent = async (user, id) => {
  return sequelize.transaction(async (transaction) => {
    const intent = await loadIntent(id, user, { transaction });
    if (!['authorized', 'held'].includes(intent.status) || toNumber(intent.captured_amount) > 0) {
      throw new ApiError(409, 'Escrow cannot be cancelled', 'ESCROW_INVALID_STATE');
    }
    const payerWallet = await intent.getPayerWallet({ transaction });
    await applyLedgerEntry(
      payerWallet,
      {
        amount: intent.amount,
        category: 'escrow_cancel',
        entryType: 'credit',
        description: `Escrow cancellation for ${intent.reference_type} ${intent.reference_id}`,
        entityType: 'escrow',
        entityId: intent.id,
        availableDelta: intent.amount,
        pendingDelta: -intent.amount,
      },
      transaction
    );
    intent.status = 'cancelled';
    intent.cancelled_at = new Date();
    intent.is_on_hold = false;
    await intent.save({ transaction });
    return intent;
  });
};

const setHold = async (user, id, reason) => {
  const now = new Date();
  return sequelize.transaction(async (transaction) => {
    const intent = await loadIntent(id, user, { transaction });
    if (intent.status === 'cancelled' || intent.status === 'refunded') {
      throw new ApiError(409, 'Escrow cannot be held', 'ESCROW_INVALID_STATE');
    }
    intent.metadata = {
      ...(intent.metadata || {}),
      previous_status: intent.metadata?.previous_status || intent.status,
    };
    intent.status = 'held';
    intent.is_on_hold = true;
    intent.hold_reason = reason;
    intent.holded_at = now;
    intent.released_at = null;
    await intent.save({ transaction });
    return intent;
  });
};

const releaseHold = async (user, id) => {
  const now = new Date();
  return sequelize.transaction(async (transaction) => {
    const intent = await loadIntent(id, user, { transaction });
    if (!intent.is_on_hold) {
      throw new ApiError(409, 'Escrow is not on hold', 'ESCROW_NOT_ON_HOLD');
    }
    const previous = intent.metadata?.previous_status || 'authorized';
    intent.status = previous;
    intent.is_on_hold = false;
    intent.hold_reason = null;
    intent.released_at = now;
    intent.metadata = { ...(intent.metadata || {}), previous_status: null };
    await intent.save({ transaction });
    return intent;
  });
};

const listEscrows = async (user, query) => {
  const pagination = buildPagination(query, ['created_at']);
  const where = {};
  if (query.status) where.status = query.status;
  if (query.reference_type) where.reference_type = query.reference_type;
  if (query.reference_id) where.reference_id = query.reference_id;
  if (user.role !== 'admin') {
    const wallet = await ensureWallet(user.id);
    where[Op.or] = [{ payer_wallet_id: wallet.id }, { payee_wallet_id: wallet.id }];
  }
  const { rows, count } = await EscrowIntent.findAndCountAll({
    where,
    include: [
      { model: Wallet, as: 'payerWallet' },
      { model: Wallet, as: 'payeeWallet' },
    ],
    limit: pagination.limit,
    order: pagination.order,
  });
  const nextCursor =
    rows.length === pagination.limit ? encodeCursor(rows[rows.length - 1][pagination.sortField]) : null;
  let analytics;
  if (query.analytics === 'true') {
    const captured = await EscrowIntent.count({ where: { status: 'captured' } });
    const disputed = await EscrowIntent.count({ where: { is_on_hold: true } });
    analytics = { captured, disputed };
  }
  return { data: rows, total: count, next_cursor: nextCursor, analytics };
};

module.exports = {
  createIntent,
  captureIntent,
  cancelIntent,
  setHold,
  releaseHold,
  listEscrows,
  loadIntent,
};
