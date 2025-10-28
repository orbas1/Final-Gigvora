'use strict';

const { Model, DataTypes } = require('sequelize');

const STATUSES = ['open', 'under_review', 'action_required', 'resolved', 'closed', 'cancelled'];

module.exports = (sequelize) => {
  class Dispute extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
      this.belongsTo(models.User, { foreignKey: 'assigned_to', as: 'assignee' });
      this.hasMany(models.DisputeMessage, { foreignKey: 'dispute_id', as: 'messages' });
      this.hasMany(models.DisputeEvidence, { foreignKey: 'dispute_id', as: 'evidence' });
      this.hasMany(models.DisputeSettlement, { foreignKey: 'dispute_id', as: 'settlements' });
      this.hasMany(models.DisputeDecision, { foreignKey: 'dispute_id', as: 'decisions' });
    }
  }

  Dispute.STATUSES = STATUSES;
  const jsonType = sequelize.getDialect() === 'postgres' ? DataTypes.JSONB : DataTypes.JSON;

  Dispute.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      entity_type: { type: DataTypes.ENUM('project', 'order'), allowNull: false },
      entity_ref: { type: DataTypes.STRING, allowNull: false },
      status: {
        type: DataTypes.ENUM(...STATUSES),
        allowNull: false,
        defaultValue: 'open',
      },
      reason: { type: DataTypes.STRING, allowNull: false },
      details: DataTypes.TEXT,
      created_by: DataTypes.UUID,
      assigned_to: DataTypes.UUID,
      resolution_summary: DataTypes.TEXT,
      metadata: jsonType,
      closed_at: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'Dispute',
      tableName: 'disputes',
      paranoid: true,
    }
  );

  return Dispute;
};
