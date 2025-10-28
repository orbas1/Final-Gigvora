'use strict';

module.exports = (sequelize, DataTypes) => {
  const jsonType = DataTypes.JSONB || DataTypes.JSON;
  const Payout = sequelize.define(
    'Payout',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      wallet_id: { type: DataTypes.UUID, allowNull: false },
      payout_account_id: { type: DataTypes.UUID, allowNull: false },
      amount: { type: DataTypes.DECIMAL(18, 4), allowNull: false },
      currency: { type: DataTypes.STRING, allowNull: false },
      status: {
        type: DataTypes.ENUM('processing', 'completed', 'failed'),
        allowNull: false,
        defaultValue: 'processing',
      },
      initiated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      processed_at: DataTypes.DATE,
      failure_code: DataTypes.STRING,
      failure_message: DataTypes.TEXT,
      idempotency_key: DataTypes.STRING,
      metadata: { type: jsonType },
    },
    {
      tableName: 'payouts',
      paranoid: true,
    }
  );

  Payout.associate = (models) => {
    Payout.belongsTo(models.Wallet, { foreignKey: 'wallet_id', as: 'wallet' });
    Payout.belongsTo(models.WalletPayoutAccount, { foreignKey: 'payout_account_id', as: 'payoutAccount' });
  };

  return Payout;
};
