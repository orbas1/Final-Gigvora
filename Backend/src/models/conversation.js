'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');

module.exports = (sequelize) => {
  class Conversation extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
      this.hasMany(models.ConversationParticipant, {
        foreignKey: 'conversation_id',
        as: 'participants',
      });
      this.hasMany(models.Message, {
        foreignKey: 'conversation_id',
        as: 'messages',
      });
    }
  }

  Conversation.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuid(),
        primaryKey: true,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      type: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'direct',
        validate: {
          isIn: [['direct', 'group']],
        },
      },
      created_by: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      last_message_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Conversation',
      tableName: 'conversations',
      paranoid: true,
      defaultScope: {
        order: [['updated_at', 'DESC']],
      },
    }
  );

  return Conversation;
};
