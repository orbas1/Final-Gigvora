'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class ProjectDeliverable extends Model {
    static associate(models) {
      this.belongsTo(models.Project, { foreignKey: 'project_id', as: 'project' });
      this.belongsTo(models.ProjectMilestone, { foreignKey: 'milestone_id', as: 'milestone' });
      this.belongsTo(models.User, { foreignKey: 'submitter_id', as: 'submitter' });
      this.belongsTo(models.User, { foreignKey: 'reviewer_id', as: 'reviewer' });
    }
  }

  ProjectDeliverable.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      project_id: { type: DataTypes.UUID, allowNull: false },
      milestone_id: DataTypes.UUID,
      submitter_id: { type: DataTypes.UUID, allowNull: false },
      reviewer_id: DataTypes.UUID,
      title: { type: DataTypes.STRING, allowNull: false },
      description: DataTypes.TEXT,
      attachments: DataTypes.JSONB || DataTypes.JSON,
      status: {
        type: DataTypes.ENUM('submitted', 'accepted', 'revision_requested'),
        allowNull: false,
        defaultValue: 'submitted',
      },
      submitted_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      reviewed_at: DataTypes.DATE,
      deleted_at: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'ProjectDeliverable',
      tableName: 'project_deliverables',
      underscored: true,
      paranoid: true,
    }
  );

  return ProjectDeliverable;
};
