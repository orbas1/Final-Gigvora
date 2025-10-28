module.exports = (sequelize, DataTypes) => {
  const PaymentTransaction = sequelize.define(
    'PaymentTransaction',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING,
        defaultValue: 'pending',
      },
      amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
      },
      currency: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.UUID,
      },
      org_id: {
        type: DataTypes.UUID,
      },
      description: {
        type: DataTypes.STRING,
      },
      metadata: {
        type: DataTypes.JSON,
      },
      related_entity: {
        type: DataTypes.STRING,
      },
      occurred_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: 'payment_transactions',
    }
  );

  PaymentTransaction.associate = (models) => {
    PaymentTransaction.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    PaymentTransaction.belongsTo(models.Organization, { foreignKey: 'org_id', as: 'organization' });
    PaymentTransaction.hasOne(models.PayoutRequest, { foreignKey: 'transaction_id', as: 'payoutRequest' });
    PaymentTransaction.hasOne(models.RefundRequest, { foreignKey: 'transaction_id', as: 'refundRequest' });
  };

  return PaymentTransaction;
};
