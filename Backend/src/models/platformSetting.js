'use strict';

const { Model, DataTypes } = require('sequelize');
const { jsonField } = require('../utils/sequelize');

module.exports = (sequelize) => {
  class PlatformSetting extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'updated_by', as: 'updatedBy' });
    }
  }

  PlatformSetting.init(
    {
      key: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      category: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      value: jsonField(sequelize, DataTypes, 'value'),
      updated_by: {
        type: DataTypes.UUID,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'PlatformSetting',
      tableName: 'platform_settings',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      paranoid: false,
    }
  );

  return PlatformSetting;
};
