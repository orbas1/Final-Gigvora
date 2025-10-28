'use strict';

module.exports = (sequelize, DataTypes) => {
  const jsonType = DataTypes.JSONB || DataTypes.JSON;
  const Invoice = sequelize.define(
    'Invoice',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      wallet_id: DataTypes.UUID,
      entity_type: { type: DataTypes.STRING, allowNull: false },
      entity_id: { type: DataTypes.STRING, allowNull: false },
      number: { type: DataTypes.STRING, allowNull: false, unique: true },
      currency: { type: DataTypes.STRING, allowNull: false },
      amount_due: { type: DataTypes.DECIMAL(18, 4), allowNull: false },
      amount_paid: { type: DataTypes.DECIMAL(18, 4), allowNull: false, defaultValue: 0 },
      status: { type: DataTypes.ENUM('draft', 'open', 'paid', 'void'), allowNull: false, defaultValue: 'open' },
      due_date: DataTypes.DATE,
      issued_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      paid_at: DataTypes.DATE,
      pdf_url: DataTypes.STRING,
      metadata: { type: jsonType },
    },
    {
      tableName: 'invoices',
      paranoid: true,
    }
  );

  Invoice.associate = (models) => {
    Invoice.belongsTo(models.Wallet, { foreignKey: 'wallet_id', as: 'wallet' });
  };

  return Invoice;
};
