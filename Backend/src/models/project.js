'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');
const { jsonColumn, enumColumn } = require('./helpers/columnTypes');

const slugify = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 190);

module.exports = (sequelize) => {
  class Project extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'owner_id', as: 'owner' });
      this.hasMany(models.ProjectTag, { foreignKey: 'project_id', as: 'tagAssignments' });
      this.hasMany(models.ProjectInvite, { foreignKey: 'project_id', as: 'invites' });
      this.hasMany(models.ProjectBid, { foreignKey: 'project_id', as: 'bids' });
      this.hasMany(models.ProjectMilestone, { foreignKey: 'project_id', as: 'milestones' });
      this.hasMany(models.ProjectDeliverable, { foreignKey: 'project_id', as: 'deliverables' });
      this.hasMany(models.ProjectTimeLog, { foreignKey: 'project_id', as: 'timeLogs' });
      this.hasMany(models.ProjectReview, { foreignKey: 'project_id', as: 'reviews' });
    }
  }

  Project.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuid(),
        primaryKey: true,
      },
      owner_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: enumColumn(
        sequelize,
        DataTypes,
        ['draft', 'open', 'in_progress', 'completed', 'cancelled', 'archived'],
        { allowNull: false, defaultValue: 'draft' }
      ),
      project_type: enumColumn(sequelize, DataTypes, ['fixed', 'hourly'], {
        allowNull: false,
        defaultValue: 'fixed',
      }),
      budget_min: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      budget_max: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      budget_currency: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'USD',
      },
      hourly_rate: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      estimated_hours: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      timeline: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      requirements: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      attachments: jsonColumn(sequelize, DataTypes, { allowNull: true }),
      tags_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      invites_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      bids_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      milestones_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      deliverables_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      timelogs_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      reviews_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      rating_average: {
        type: DataTypes.DECIMAL(4, 2),
        allowNull: true,
      },
      last_activity_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      metadata: jsonColumn(sequelize, DataTypes, { allowNull: true }),
    },
    {
      sequelize,
      modelName: 'Project',
      tableName: 'projects',
      paranoid: true,
      indexes: [
        { fields: ['status'] },
        { fields: ['project_type'] },
        { fields: ['owner_id'] },
      ],
      hooks: {
        beforeValidate(project) {
          if (project.title && !project.slug) {
            project.slug = slugify(project.title);
          }
        },
        beforeSave(project) {
          if (project.changed('title')) {
            project.slug = slugify(project.title);
          }
          if (project.changed()) {
            project.last_activity_at = new Date();
          }
        },
      },
    }
  );

  return Project;
};
