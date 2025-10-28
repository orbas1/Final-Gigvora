'use strict';

const { Model, DataTypes } = require('sequelize');
const { enumColumn } = require('./helpers/columnTypes');

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
      status: enumColumn(sequelize, DataTypes, ['open', 'pending', 'closed']),
      subject: DataTypes.STRING,
      priority: enumColumn(sequelize, DataTypes, ['low', 'normal', 'high']),
    },
    {
      sequelize,
      modelName: 'SupportTicket',
      tableName: 'support_tickets',
    }
  );

  return SupportTicket;
};
