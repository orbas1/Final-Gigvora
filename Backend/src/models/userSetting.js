'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class UserSetting extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }

  const jsonType = DataTypes.JSONB || DataTypes.JSON;

  UserSetting.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
      },
      account: {
        type: jsonType,
        defaultValue: () => ({})
      },
      security: {
        type: jsonType,
        defaultValue: () => ({})
      },
      privacy: {
        type: jsonType,
        defaultValue: () => ({})
      },
      notifications: {
        type: jsonType,
        defaultValue: () => ({})
      },
      payments: {
        type: jsonType,
        defaultValue: () => ({})
      },
      theme: {
        type: jsonType,
        defaultValue: () => ({})
      },
    },
    {
      sequelize,
      modelName: 'UserSetting',
      tableName: 'user_settings',
    }
  );

  return UserSetting;
};
