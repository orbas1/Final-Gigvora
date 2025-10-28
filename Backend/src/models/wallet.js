'use strict';

module.exports = (sequelize, DataTypes) => {
  const jsonType = DataTypes.JSONB || DataTypes.JSON;
  const Wallet = sequelize.define(
    'Wallet',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      user_id: { type: DataTypes.UUID, allowNull: false },
      provider: { type: DataTypes.STRING, allowNull: false, defaultValue: 'internal' },
      provider_account_id: { type: DataTypes.STRING },
      currency: { type: DataTypes.STRING, allowNull: false, defaultValue: 'USD' },
      available_balance: { type: DataTypes.DECIMAL(18, 4), allowNull: false, defaultValue: 0 },
      pending_balance: { type: DataTypes.DECIMAL(18, 4), allowNull: false, defaultValue: 0 },
      metadata: { type: jsonType },
    },
    {
      tableName: 'wallets',
      paranoid: true,
    }
  );

  Wallet.associate = (models) => {
    Wallet.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    Wallet.hasMany(models.WalletPaymentMethod, { foreignKey: 'wallet_id', as: 'paymentMethods' });
    Wallet.hasMany(models.WalletPayoutAccount, { foreignKey: 'wallet_id', as: 'payoutAccounts' });
    Wallet.hasMany(models.EscrowIntent, { foreignKey: 'payer_wallet_id', as: 'payerEscrows' });
    Wallet.hasMany(models.EscrowIntent, { foreignKey: 'payee_wallet_id', as: 'payeeEscrows' });
    Wallet.hasMany(models.Payout, { foreignKey: 'wallet_id', as: 'payouts' });
    Wallet.hasMany(models.LedgerEntry, { foreignKey: 'wallet_id', as: 'ledgerEntries' });
    Wallet.hasMany(models.Invoice, { foreignKey: 'wallet_id', as: 'invoices' });
  };

  return Wallet;
};
