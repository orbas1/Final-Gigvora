'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class UserSetting extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }

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
      preferences: DataTypes.JSONB || DataTypes.JSON,
      security: DataTypes.JSONB || DataTypes.JSON,
      privacy: DataTypes.JSONB || DataTypes.JSON,
      theme: DataTypes.JSONB || DataTypes.JSON,
    },
    {
      sequelize,
      modelName: 'UserSetting',
      tableName: 'user_settings',
    }
  );

  return UserSetting;
};
