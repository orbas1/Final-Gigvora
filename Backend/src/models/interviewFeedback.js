'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');

module.exports = (sequelize) => {
  class InterviewFeedback extends Model {
    static associate(models) {
      this.belongsTo(models.Interview, { foreignKey: 'interview_id', as: 'interview' });
      this.belongsTo(models.User, { foreignKey: 'reviewer_id', as: 'reviewer' });
    }
  }

  InterviewFeedback.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuid(),
        primaryKey: true,
      },
      interview_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      reviewer_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      rating: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      highlights: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      concerns: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      recommendation: {
        type: DataTypes.ENUM('strong_hire', 'hire', 'no_hire', 'strong_no_hire', 'undecided'),
        allowNull: true,
      },
      submitted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'InterviewFeedback',
      tableName: 'interview_feedback',
      paranoid: true,
    }
  );

  return InterviewFeedback;
};
