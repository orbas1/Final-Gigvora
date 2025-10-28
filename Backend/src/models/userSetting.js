'use strict';

const { Model, DataTypes } = require('sequelize');
const { jsonColumn } = require('./helpers/columnTypes');

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
      preferences: jsonColumn(sequelize, DataTypes),
      security: jsonColumn(sequelize, DataTypes),
      privacy: jsonColumn(sequelize, DataTypes),
      theme: jsonColumn(sequelize, DataTypes),
    },
    {
      sequelize,
      modelName: 'UserSetting',
      tableName: 'user_settings',
    }
  );

  return UserSetting;
};
