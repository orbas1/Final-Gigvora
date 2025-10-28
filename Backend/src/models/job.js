'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');

const slugify = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 190);

module.exports = (sequelize) => {
  class Job extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'posted_by', as: 'owner' });
      this.belongsTo(models.User, { foreignKey: 'company_id', as: 'company' });
      this.hasMany(models.JobStage, { foreignKey: 'job_id', as: 'stages' });
      this.hasMany(models.JobTag, { foreignKey: 'job_id', as: 'tagAssignments' });
      this.hasMany(models.JobApplication, { foreignKey: 'job_id', as: 'applications' });
      this.hasMany(models.JobMetric, { foreignKey: 'job_id', as: 'metrics' });
      this.hasMany(models.Interview, { foreignKey: 'job_id', as: 'interviews' });
    }
  }

  Job.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuid(),
        primaryKey: true,
      },
      posted_by: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      company_id: {
        type: DataTypes.UUID,
        allowNull: true,
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
      location: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      job_type: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      salary_min: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      salary_max: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      salary_currency: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'USD',
      },
      status: {
        type: DataTypes.ENUM('draft', 'open', 'paused', 'closed', 'archived'),
        allowNull: false,
        defaultValue: 'draft',
      },
      published_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      closes_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      views_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      applications_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      hires_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      metadata: {
        type: DataTypes.JSONB || DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Job',
      tableName: 'jobs',
      paranoid: true,
      indexes: [{ fields: ['status'] }],
      hooks: {
        beforeValidate(job) {
          if (job.title && !job.slug) {
            job.slug = slugify(job.title);
          }
        },
        beforeSave(job) {
          if (job.changed('title')) {
            job.slug = slugify(job.title);
          }
          if (job.status === 'open' && !job.published_at) {
            job.published_at = new Date();
          }
        },
      },
    }
  );

  return Job;
};
