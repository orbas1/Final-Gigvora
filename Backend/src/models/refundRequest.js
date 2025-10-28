module.exports = (sequelize, DataTypes) => {
  const RefundRequest = sequelize.define(
    'RefundRequest',
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
      requester_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING,
        defaultValue: 'pending',
      },
      reason: {
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
      tableName: 'refund_requests',
    }
  );

  RefundRequest.associate = (models) => {
    RefundRequest.belongsTo(models.PaymentTransaction, { foreignKey: 'transaction_id', as: 'transaction' });
    RefundRequest.belongsTo(models.User, { foreignKey: 'requester_id', as: 'requester' });
    RefundRequest.belongsTo(models.User, { foreignKey: 'processed_by', as: 'processedBy' });
  };

  return RefundRequest;
};
