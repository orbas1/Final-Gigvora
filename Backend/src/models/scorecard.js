'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');

module.exports = (sequelize) => {
  class Scorecard extends Model {
    static associate(models) {
      this.belongsTo(models.JobApplication, { foreignKey: 'application_id', as: 'application' });
      this.belongsTo(models.User, { foreignKey: 'reviewer_id', as: 'reviewer' });
    }
  }

  Scorecard.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuid(),
        primaryKey: true,
      },
      application_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      reviewer_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      overall_rating: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      recommendation: {
        type: DataTypes.ENUM('strong_hire', 'hire', 'no_hire', 'strong_no_hire', 'undecided'),
        allowNull: true,
      },
      competencies: {
        type: DataTypes.JSONB || DataTypes.JSON,
        allowNull: true,
      },
      summary: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      submitted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Scorecard',
      tableName: 'scorecards',
      paranoid: true,
    }
  );

  return Scorecard;
};
