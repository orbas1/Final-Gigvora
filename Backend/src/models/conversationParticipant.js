'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');

module.exports = (sequelize) => {
  class ConversationParticipant extends Model {
    static associate(models) {
      this.belongsTo(models.Conversation, { foreignKey: 'conversation_id', as: 'conversation' });
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
      this.belongsTo(models.Message, { foreignKey: 'last_read_message_id', as: 'lastReadMessage' });
    }
  }

  ConversationParticipant.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuid(),
        primaryKey: true,
      },
      conversation_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      role: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'member',
      },
      pinned: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      archived: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      last_read_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      last_read_message_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      unread_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      joined_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      left_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'ConversationParticipant',
      tableName: 'conversation_participants',
      paranoid: false,
    }
  );

  return ConversationParticipant;
};
