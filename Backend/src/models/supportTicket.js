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
      user_id: { type: DataTypes.UUID, allowNull: false },
      status: {
        type: DataTypes.ENUM('open', 'pending', 'closed'),
        allowNull: false,
        defaultValue: 'open',
      },
      subject: { type: DataTypes.STRING, allowNull: false },
      priority: {
        type: DataTypes.ENUM('low', 'normal', 'high'),
        allowNull: false,
        defaultValue: 'normal',
      },
    },
    {
      sequelize,
      modelName: 'SupportTicket',
      tableName: 'support_tickets',
      underscored: true,
      paranoid: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
      defaultScope: {
        attributes: { exclude: ['deleted_at'] },
      },
      scopes: {
        withDeleted: { paranoid: false },
      },
    }
  );

  return SupportTicket;
};
