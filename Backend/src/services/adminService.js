const {
  User,
  Profile,
  WalletPaymentMethod,
  WalletPayoutAccount,
  EscrowIntent,
  Payout,
  Refund,
  Invoice,
} = require('../models');
const { ApiError } = require('../middleware/errorHandler');

const overview = async ({ from, to }) => {
  const totalUsers = await User.count();
  return { totalUsers, from, to };
};

const listUsers = async () => User.findAll({ limit: 100 });

const RESTORABLE = {
  user: User,
  profile: Profile,
  wallet_payment_method: WalletPaymentMethod,
  wallet_payout_account: WalletPayoutAccount,
  escrow_intent: EscrowIntent,
  payout: Payout,
  refund: Refund,
  invoice: Invoice,
};

const restore = async ({ entity_type, id }) => {
  const Model = RESTORABLE[entity_type];
  if (!Model) {
    throw new ApiError(400, 'Unsupported entity type', 'INVALID_ENTITY');
  }
  const [restored] = await Model.restore({ where: { id } });
  if (restored === 0) {
    throw new ApiError(404, 'Entity not found', 'ENTITY_NOT_FOUND');
  }
  return { success: true };
};

module.exports = { overview, listUsers, restore };
