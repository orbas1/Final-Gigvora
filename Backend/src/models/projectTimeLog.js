'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class ProjectTimeLog extends Model {
    static associate(models) {
      this.belongsTo(models.Project, { foreignKey: 'project_id', as: 'project' });
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
      this.belongsTo(models.User, { foreignKey: 'approved_by', as: 'approver' });
    }
  }

  ProjectTimeLog.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      project_id: { type: DataTypes.UUID, allowNull: false },
      user_id: { type: DataTypes.UUID, allowNull: false },
      started_at: { type: DataTypes.DATE, allowNull: false },
      ended_at: DataTypes.DATE,
      duration_minutes: { type: DataTypes.INTEGER, allowNull: false },
      notes: DataTypes.TEXT,
      status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
      },
      approved_by: DataTypes.UUID,
      approved_at: DataTypes.DATE,
      deleted_at: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'ProjectTimeLog',
      tableName: 'project_time_logs',
      underscored: true,
      paranoid: true,
    }
  );

  return ProjectTimeLog;
};
