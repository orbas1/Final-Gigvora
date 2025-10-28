'use strict';

module.exports = (sequelize, DataTypes) => {
  const jsonType = DataTypes.JSONB || DataTypes.JSON;
  const EscrowIntent = sequelize.define(
    'EscrowIntent',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      reference_type: { type: DataTypes.STRING, allowNull: false },
      reference_id: { type: DataTypes.STRING, allowNull: false },
      payer_wallet_id: { type: DataTypes.UUID, allowNull: false },
      payee_wallet_id: { type: DataTypes.UUID, allowNull: false },
      amount: { type: DataTypes.DECIMAL(18, 4), allowNull: false },
      currency: { type: DataTypes.STRING, allowNull: false },
      status: {
        type: DataTypes.ENUM('authorized', 'held', 'captured', 'cancelled', 'refunded'),
        allowNull: false,
        defaultValue: 'authorized',
      },
      captured_amount: { type: DataTypes.DECIMAL(18, 4), allowNull: false, defaultValue: 0 },
      refunded_amount: { type: DataTypes.DECIMAL(18, 4), allowNull: false, defaultValue: 0 },
      fee_amount: { type: DataTypes.DECIMAL(18, 4), allowNull: false, defaultValue: 0 },
      is_on_hold: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      hold_reason: DataTypes.TEXT,
      metadata: { type: jsonType },
      idempotency_key: DataTypes.STRING,
      authorized_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      captured_at: DataTypes.DATE,
      cancelled_at: DataTypes.DATE,
      refunded_at: DataTypes.DATE,
      holded_at: DataTypes.DATE,
      released_at: DataTypes.DATE,
    },
    {
      tableName: 'escrow_intents',
      paranoid: true,
    }
  );

  EscrowIntent.associate = (models) => {
    EscrowIntent.belongsTo(models.Wallet, { foreignKey: 'payer_wallet_id', as: 'payerWallet' });
    EscrowIntent.belongsTo(models.Wallet, { foreignKey: 'payee_wallet_id', as: 'payeeWallet' });
    EscrowIntent.hasMany(models.Refund, { foreignKey: 'escrow_id', as: 'refunds' });
  };

  return EscrowIntent;
};
