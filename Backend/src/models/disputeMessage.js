'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class DisputeMessage extends Model {
    static associate(models) {
      this.belongsTo(models.Dispute, { foreignKey: 'dispute_id', as: 'dispute' });
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'author' });
    }
  }

  const jsonType = sequelize.getDialect() === 'postgres' ? DataTypes.JSONB : DataTypes.JSON;

  DisputeMessage.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      dispute_id: { type: DataTypes.UUID, allowNull: false },
      user_id: DataTypes.UUID,
      body: { type: DataTypes.TEXT, allowNull: false },
      attachments: jsonType,
      visibility: {
        type: DataTypes.ENUM('party', 'internal'),
        defaultValue: 'party',
      },
    },
    {
      sequelize,
      modelName: 'DisputeMessage',
      tableName: 'dispute_messages',
      paranoid: true,
    }
  );

  return DisputeMessage;
};
