'use strict';

module.exports = (sequelize, DataTypes) => {
  const jsonType = DataTypes.JSONB || DataTypes.JSON;
  const Refund = sequelize.define(
    'Refund',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      escrow_id: { type: DataTypes.UUID, allowNull: false },
      amount: { type: DataTypes.DECIMAL(18, 4), allowNull: false },
      currency: { type: DataTypes.STRING, allowNull: false },
      status: {
        type: DataTypes.ENUM('pending', 'processed', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      reason: DataTypes.TEXT,
      idempotency_key: DataTypes.STRING,
      processed_at: DataTypes.DATE,
      metadata: { type: jsonType },
    },
    {
      tableName: 'refunds',
      paranoid: true,
    }
  );

  Refund.associate = (models) => {
    Refund.belongsTo(models.EscrowIntent, { foreignKey: 'escrow_id', as: 'escrow' });
  };

  return Refund;
};
