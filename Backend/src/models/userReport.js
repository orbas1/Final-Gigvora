'use strict';

const { Model, DataTypes } = require('sequelize');
const { enumColumn } = require('./helpers/columnTypes');

module.exports = (sequelize) => {
  class UserReport extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'reporter_id', as: 'reporter' });
      this.belongsTo(models.User, { foreignKey: 'reported_id', as: 'reported' });
    }
  }

  UserReport.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      reporter_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      reported_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      reason: DataTypes.STRING,
      description: DataTypes.TEXT,
      status: enumColumn(sequelize, DataTypes, ['pending', 'reviewed', 'actioned'], {
        defaultValue: 'pending',
      }),
    },
    {
      sequelize,
      modelName: 'UserReport',
      tableName: 'user_reports',
    }
  );

  return UserReport;
};
