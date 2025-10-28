'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class DisputeEvidence extends Model {
    static associate(models) {
      this.belongsTo(models.Dispute, { foreignKey: 'dispute_id', as: 'dispute' });
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'uploader' });
      this.belongsTo(models.FileAsset, { foreignKey: 'file_id', as: 'file' });
    }
  }

  const jsonType = sequelize.getDialect() === 'postgres' ? DataTypes.JSONB : DataTypes.JSON;

  DisputeEvidence.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      dispute_id: { type: DataTypes.UUID, allowNull: false },
      user_id: DataTypes.UUID,
      kind: { type: DataTypes.STRING, allowNull: false },
      title: DataTypes.STRING,
      description: DataTypes.TEXT,
      file_id: DataTypes.UUID,
      metadata: jsonType,
    },
    {
      sequelize,
      modelName: 'DisputeEvidence',
      tableName: 'dispute_evidence',
      paranoid: true,
    }
  );

  return DisputeEvidence;
};
