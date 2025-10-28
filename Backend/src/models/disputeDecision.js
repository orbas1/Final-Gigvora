'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class DisputeDecision extends Model {
    static associate(models) {
      this.belongsTo(models.Dispute, { foreignKey: 'dispute_id', as: 'dispute' });
      this.belongsTo(models.User, { foreignKey: 'decided_by', as: 'decider' });
    }
  }

  const jsonType = sequelize.getDialect() === 'postgres' ? DataTypes.JSONB : DataTypes.JSON;

  DisputeDecision.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      dispute_id: { type: DataTypes.UUID, allowNull: false },
      decided_by: DataTypes.UUID,
      outcome: {
        type: DataTypes.ENUM('resolved_for_claimant', 'resolved_for_respondent', 'split', 'escalated'),
        allowNull: false,
      },
      award_amount: DataTypes.DECIMAL(15, 2),
      award_currency: DataTypes.STRING(3),
      summary: DataTypes.TEXT,
      metadata: jsonType,
      decided_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: 'DisputeDecision',
      tableName: 'dispute_decisions',
    }
  );

  return DisputeDecision;
};
