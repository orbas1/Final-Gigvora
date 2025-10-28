const { ApiError } = require('../middleware/errorHandler');
const { EscrowIntent, Wallet } = require('../models');
const { markPayoutCompleted } = require('./payoutService');

const toNumber = (value) => Number(value || 0);

const syncWalletBalance = async (walletId, snapshot) => {
  const wallet = await Wallet.findByPk(walletId);
  if (!wallet) {
    throw new ApiError(404, 'Wallet not found', 'WALLET_NOT_FOUND');
  }
  await wallet.update({
    available_balance: snapshot.available,
    pending_balance: snapshot.pending,
    metadata: { ...(wallet.metadata || {}), snapshot_at: new Date().toISOString() },
  });
  return wallet;
};

const handleEscrowStatus = async (payload) => {
  const intent = await EscrowIntent.findByPk(payload.id);
  if (!intent) {
    throw new ApiError(404, 'Escrow intent not found', 'ESCROW_NOT_FOUND');
  }
  if (payload.status === 'captured') {
    intent.status = 'captured';
    intent.captured_amount = toNumber(payload.captured_amount || intent.amount);
    intent.captured_at = payload.captured_at ? new Date(payload.captured_at) : new Date();
  }
  if (payload.status === 'refunded') {
    intent.status = 'refunded';
    intent.refunded_amount = toNumber(payload.refunded_amount || intent.refunded_amount);
    intent.refunded_at = payload.refunded_at ? new Date(payload.refunded_at) : new Date();
  }
  if (payload.is_on_hold !== undefined) {
    intent.is_on_hold = Boolean(payload.is_on_hold);
    intent.status = intent.is_on_hold ? 'held' : intent.status;
    intent.hold_reason = payload.hold_reason || null;
  }
  intent.metadata = { ...(intent.metadata || {}), psp_reference: payload.reference || payload.id };
  await intent.save();
  return intent;
};

const processWebhook = async (body) => {
  const event = body?.type;
  if (!event) {
    throw new ApiError(400, 'Event type missing', 'VALIDATION_ERROR');
  }
  switch (event) {
    case 'wallet.balance.updated':
      await syncWalletBalance(body.data.wallet_id, body.data.balance);
      break;
    case 'escrow.captured':
    case 'escrow.refunded':
    case 'escrow.held':
    case 'escrow.released':
      await handleEscrowStatus(body.data);
      break;
    case 'payout.completed':
      await markPayoutCompleted(body.data.id, true, { processor: body.data.processor, reference: body.data.reference });
      break;
    case 'payout.failed':
      await markPayoutCompleted(body.data.id, false, { failure_reason: body.data.reason });
      break;
    default:
      throw new ApiError(400, `Unsupported event ${event}`, 'UNSUPPORTED_EVENT');
  }
  return { received: true };
};

module.exports = { processWebhook };
