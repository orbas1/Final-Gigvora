'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');

module.exports = (sequelize) => {
  class Message extends Model {
    static associate(models) {
      this.belongsTo(models.Conversation, { foreignKey: 'conversation_id', as: 'conversation' });
      this.belongsTo(models.User, { foreignKey: 'sender_id', as: 'sender' });
      this.hasMany(models.MessageRead, { foreignKey: 'message_id', as: 'reads' });
    }
  }

  Message.init(
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
      sender_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      text: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      attachments: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
        get() {
          const raw = this.getDataValue('attachments');
          if (!raw) return [];
          if (Array.isArray(raw)) return raw;
          try {
            return JSON.parse(raw);
          } catch (error) {
            return [];
          }
        },
        set(value) {
          if (!value) {
            this.setDataValue('attachments', []);
          } else if (Array.isArray(value)) {
            this.setDataValue('attachments', value);
          } else {
            this.setDataValue('attachments', [value]);
          }
        },
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      edited_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Message',
      tableName: 'messages',
      paranoid: true,
      defaultScope: {
        order: [['created_at', 'DESC']],
      },
      hooks: {
        beforeCreate: (message) => {
          if (!message.attachments) {
            message.attachments = [];
          }
        },
        beforeUpdate: (message) => {
          if (!message.attachments) {
            message.attachments = [];
          }
        },
      },
    }
  );

  return Message;
};
