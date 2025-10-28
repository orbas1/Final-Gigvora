'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');

module.exports = (sequelize) => {
  class JobApplication extends Model {
    static associate(models) {
      this.belongsTo(models.Job, { foreignKey: 'job_id', as: 'job' });
      this.belongsTo(models.JobStage, { foreignKey: 'stage_id', as: 'stage' });
      this.belongsTo(models.User, { foreignKey: 'candidate_id', as: 'candidate' });
      this.hasMany(models.ApplicationTag, { foreignKey: 'application_id', as: 'tagAssignments' });
      this.hasMany(models.Scorecard, { foreignKey: 'application_id', as: 'scorecards' });
      this.hasMany(models.Interview, { foreignKey: 'application_id', as: 'interviews' });
    }
  }

  JobApplication.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuid(),
        primaryKey: true,
      },
      job_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      stage_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      candidate_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      resume_url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      parsed_fields: {
        type: DataTypes.JSONB || DataTypes.JSON,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('applied', 'screening', 'interviewing', 'offered', 'hired', 'rejected', 'withdrawn'),
        allowNull: false,
        defaultValue: 'applied',
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      rating: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      tags_snapshot: {
        type: DataTypes.JSONB || DataTypes.JSON,
        allowNull: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      withdrew_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      hired_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'JobApplication',
      tableName: 'job_applications',
      paranoid: true,
      defaultScope: {
        order: [['created_at', 'DESC']],
      },
    }
  );

  return JobApplication;
};
