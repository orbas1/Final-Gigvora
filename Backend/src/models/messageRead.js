'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');

module.exports = (sequelize) => {
  class MessageRead extends Model {
    static associate(models) {
      this.belongsTo(models.Message, { foreignKey: 'message_id', as: 'message' });
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }

  MessageRead.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuid(),
        primaryKey: true,
      },
      message_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      read_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      modelName: 'MessageRead',
      tableName: 'message_reads',
      paranoid: false,
    }
  );

  return MessageRead;
};
