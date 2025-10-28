module.exports = (sequelize, DataTypes) => {
  const PayoutRequest = sequelize.define(
    'PayoutRequest',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      transaction_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      recipient_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING,
        defaultValue: 'pending',
      },
      notes: {
        type: DataTypes.TEXT,
      },
      processed_by: {
        type: DataTypes.UUID,
      },
      processed_at: {
        type: DataTypes.DATE,
      },
      metadata: {
        type: DataTypes.JSON,
      },
    },
    {
      tableName: 'payout_requests',
    }
  );

  PayoutRequest.associate = (models) => {
    PayoutRequest.belongsTo(models.PaymentTransaction, { foreignKey: 'transaction_id', as: 'transaction' });
    PayoutRequest.belongsTo(models.User, { foreignKey: 'recipient_id', as: 'recipient' });
    PayoutRequest.belongsTo(models.User, { foreignKey: 'processed_by', as: 'processedBy' });
  };

  return PayoutRequest;
};
