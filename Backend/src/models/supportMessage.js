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
      ticket_id: { type: DataTypes.UUID, allowNull: false },
      user_id: { type: DataTypes.UUID, allowNull: true },
      body: { type: DataTypes.TEXT, allowNull: false },
    },
    {
      sequelize,
      modelName: 'SupportMessage',
      tableName: 'support_messages',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  return SupportMessage;
};
