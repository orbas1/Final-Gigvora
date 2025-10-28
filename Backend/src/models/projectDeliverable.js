'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');
const { jsonColumn, enumColumn } = require('./helpers/columnTypes');

module.exports = (sequelize) => {
  class ProjectDeliverable extends Model {
    static associate(models) {
      this.belongsTo(models.Project, { foreignKey: 'project_id', as: 'project' });
      this.belongsTo(models.ProjectMilestone, { foreignKey: 'milestone_id', as: 'milestone' });
      this.belongsTo(models.User, { foreignKey: 'submitted_by', as: 'submitter' });
    }
  }

  ProjectDeliverable.init(
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
      milestone_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      submitted_by: {
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
      status: enumColumn(
        sequelize,
        DataTypes,
        ['submitted', 'in_review', 'changes_requested', 'approved', 'rejected'],
        { allowNull: false, defaultValue: 'submitted' }
      ),
      file_urls: jsonColumn(sequelize, DataTypes, { allowNull: true }),
      approved_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      rejected_at: {
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
      modelName: 'ProjectDeliverable',
      tableName: 'project_deliverables',
      paranoid: true,
      indexes: [
        { fields: ['project_id'] },
        { fields: ['milestone_id'] },
        { fields: ['submitted_by'] },
      ],
    }
  );

  return ProjectDeliverable;
};
