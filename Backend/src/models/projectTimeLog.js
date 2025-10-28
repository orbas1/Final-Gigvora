'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');
const { enumColumn } = require('./helpers/columnTypes');

module.exports = (sequelize) => {
  class ProjectTimeLog extends Model {
    static associate(models) {
      this.belongsTo(models.Project, { foreignKey: 'project_id', as: 'project' });
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }

  ProjectTimeLog.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuid(),
        primaryKey: true,
      },
      project_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      started_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      ended_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      duration_minutes: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      hourly_rate: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      billable_amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      invoice_status: enumColumn(sequelize, DataTypes, ['pending', 'invoiced', 'paid', 'written_off'], {
        allowNull: false,
        defaultValue: 'pending',
      }),
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'ProjectTimeLog',
      tableName: 'project_time_logs',
      paranoid: true,
      indexes: [
        { fields: ['project_id'] },
        { fields: ['user_id'] },
        { fields: ['invoice_status'] },
      ],
    }
  );

  return ProjectTimeLog;
};
