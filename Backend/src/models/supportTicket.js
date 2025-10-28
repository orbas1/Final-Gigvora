'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class SupportTicket extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
      this.hasMany(models.SupportMessage, { foreignKey: 'ticket_id', as: 'messages' });
    }
  }

  SupportTicket.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      user_id: DataTypes.UUID,
      status: DataTypes.ENUM('open', 'pending', 'closed'),
      subject: DataTypes.STRING,
      priority: DataTypes.ENUM('low', 'normal', 'high'),
    },
    {
      sequelize,
      modelName: 'SupportTicket',
      tableName: 'support_tickets',
    }
  );

  return SupportTicket;
};
