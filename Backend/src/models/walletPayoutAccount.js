'use strict';

module.exports = (sequelize, DataTypes) => {
  const jsonType = DataTypes.JSONB || DataTypes.JSON;
  const WalletPayoutAccount = sequelize.define(
    'WalletPayoutAccount',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      wallet_id: { type: DataTypes.UUID, allowNull: false },
      type: { type: DataTypes.STRING, allowNull: false },
      account_holder_name: { type: DataTypes.STRING, allowNull: false },
      account_identifier_last4: DataTypes.STRING,
      bank_name: DataTypes.STRING,
      routing_number: DataTypes.STRING,
      currency: { type: DataTypes.STRING, allowNull: false },
      country: DataTypes.STRING,
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'verified' },
      external_account_id: DataTypes.STRING,
      verified_at: DataTypes.DATE,
      metadata: { type: jsonType },
    },
    {
      tableName: 'wallet_payout_accounts',
      paranoid: true,
    }
  );

  WalletPayoutAccount.associate = (models) => {
    WalletPayoutAccount.belongsTo(models.Wallet, { foreignKey: 'wallet_id', as: 'wallet' });
    WalletPayoutAccount.hasMany(models.Payout, { foreignKey: 'payout_account_id', as: 'payouts' });
  };

  return WalletPayoutAccount;
};
