'use strict';

module.exports = (sequelize, DataTypes) => {
  const jsonType = DataTypes.JSONB || DataTypes.JSON;
  const WalletPaymentMethod = sequelize.define(
    'WalletPaymentMethod',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      wallet_id: { type: DataTypes.UUID, allowNull: false },
      type: { type: DataTypes.STRING, allowNull: false },
      label: DataTypes.STRING,
      brand: DataTypes.STRING,
      last4: DataTypes.STRING,
      exp_month: DataTypes.INTEGER,
      exp_year: DataTypes.INTEGER,
      country: DataTypes.STRING,
      fingerprint: DataTypes.STRING,
      is_default: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'active' },
      metadata: { type: jsonType },
    },
    {
      tableName: 'wallet_payment_methods',
      paranoid: true,
      defaultScope: {
        attributes: { exclude: ['fingerprint'] },
      },
      scopes: {
        withFingerprint: { attributes: { include: ['fingerprint'] } },
      },
    }
  );

  WalletPaymentMethod.associate = (models) => {
    WalletPaymentMethod.belongsTo(models.Wallet, { foreignKey: 'wallet_id', as: 'wallet' });
  };

  return WalletPaymentMethod;
};
