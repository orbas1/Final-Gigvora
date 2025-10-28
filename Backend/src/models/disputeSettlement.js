'use strict';

const { Model, DataTypes } = require('sequelize');

const SETTLEMENT_STATUSES = ['proposed', 'accepted', 'declined', 'expired'];

module.exports = (sequelize) => {
  class DisputeSettlement extends Model {
    static associate(models) {
      this.belongsTo(models.Dispute, { foreignKey: 'dispute_id', as: 'dispute' });
      this.belongsTo(models.User, { foreignKey: 'proposed_by', as: 'proposer' });
    }
  }

  DisputeSettlement.STATUSES = SETTLEMENT_STATUSES;
  const jsonType = sequelize.getDialect() === 'postgres' ? DataTypes.JSONB : DataTypes.JSON;

  DisputeSettlement.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      dispute_id: { type: DataTypes.UUID, allowNull: false },
      proposed_by: DataTypes.UUID,
      type: { type: DataTypes.ENUM('partial', 'full'), allowNull: false },
      amount: DataTypes.DECIMAL(15, 2),
      currency: DataTypes.STRING(3),
      terms: DataTypes.TEXT,
      status: {
        type: DataTypes.ENUM(...SETTLEMENT_STATUSES),
        allowNull: false,
        defaultValue: 'proposed',
      },
      responded_at: DataTypes.DATE,
      metadata: jsonType,
    },
    {
      sequelize,
      modelName: 'DisputeSettlement',
      tableName: 'dispute_settlements',
    }
  );

  return DisputeSettlement;
};
