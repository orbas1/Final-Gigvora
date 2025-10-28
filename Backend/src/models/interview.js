'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');

module.exports = (sequelize) => {
  class Interview extends Model {
    static associate(models) {
      this.belongsTo(models.Job, { foreignKey: 'job_id', as: 'job' });
      this.belongsTo(models.JobApplication, { foreignKey: 'application_id', as: 'application' });
      this.hasMany(models.InterviewFeedback, { foreignKey: 'interview_id', as: 'feedback' });
    }
  }

  Interview.init(
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
      application_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      scheduled_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      duration_minutes: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      meeting_url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      location: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('scheduled', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'scheduled',
      },
      panel: {
        type: DataTypes.JSONB || DataTypes.JSON,
        allowNull: true,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      recording_url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Interview',
      tableName: 'interviews',
      paranoid: true,
    }
  );

  return Interview;
};
