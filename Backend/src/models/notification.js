'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Notification extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }

  Notification.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      type: DataTypes.STRING,
      data: DataTypes.JSONB || DataTypes.JSON,
      read_at: DataTypes.DATE,
      channel: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: 'Notification',
      tableName: 'notifications',
    }
  );

  return Notification;
};
