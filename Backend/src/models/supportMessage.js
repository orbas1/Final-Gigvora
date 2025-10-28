'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class SupportMessage extends Model {
    static associate(models) {
      this.belongsTo(models.SupportTicket, { foreignKey: 'ticket_id', as: 'ticket' });
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }

  SupportMessage.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      ticket_id: DataTypes.UUID,
      user_id: DataTypes.UUID,
      body: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: 'SupportMessage',
      tableName: 'support_messages',
    }
  );

  return SupportMessage;
};
