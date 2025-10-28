'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');
const { enumColumn } = require('./helpers/columnTypes');

module.exports = (sequelize) => {
  class ProjectMilestone extends Model {
    static associate(models) {
      this.belongsTo(models.Project, { foreignKey: 'project_id', as: 'project' });
      this.hasMany(models.ProjectDeliverable, { foreignKey: 'milestone_id', as: 'deliverables' });
    }
  }

  ProjectMilestone.init(
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
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      currency: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'USD',
      },
      due_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      order_index: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      status: enumColumn(sequelize, DataTypes, ['pending', 'in_progress', 'completed', 'released', 'cancelled'], {
        allowNull: false,
        defaultValue: 'pending',
      }),
      released_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      completed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'ProjectMilestone',
      tableName: 'project_milestones',
      paranoid: true,
      indexes: [{ fields: ['project_id'] }],
    }
  );

  return ProjectMilestone;
};
