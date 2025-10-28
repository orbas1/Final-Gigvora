'use strict';

module.exports = (sequelize, DataTypes) => {
  const jsonType = DataTypes.JSONB || DataTypes.JSON;
  const LedgerEntry = sequelize.define(
    'LedgerEntry',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      wallet_id: { type: DataTypes.UUID, allowNull: false },
      entity_type: DataTypes.STRING,
      entity_id: DataTypes.STRING,
      entry_type: { type: DataTypes.ENUM('debit', 'credit'), allowNull: false },
      category: { type: DataTypes.STRING, allowNull: false },
      amount: { type: DataTypes.DECIMAL(18, 4), allowNull: false },
      currency: { type: DataTypes.STRING, allowNull: false },
      balance_after: { type: DataTypes.DECIMAL(18, 4), allowNull: false, defaultValue: 0 },
      description: DataTypes.STRING,
      metadata: { type: jsonType },
      occurred_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      tableName: 'ledger_entries',
      paranoid: false,
    }
  );

  LedgerEntry.associate = (models) => {
    LedgerEntry.belongsTo(models.Wallet, { foreignKey: 'wallet_id', as: 'wallet' });
  };

  return LedgerEntry;
};
