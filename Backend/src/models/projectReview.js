'use strict';

const { Model, DataTypes } = require('sequelize');
const { getJsonType } = require('../utils/sequelize');

module.exports = (sequelize) => {
  const jsonType = getJsonType(sequelize, DataTypes);
  class ProjectReview extends Model {
    static associate(models) {
      this.belongsTo(models.Project, { foreignKey: 'project_id', as: 'project' });
      this.belongsTo(models.User, { foreignKey: 'reviewer_id', as: 'reviewer' });
      this.belongsTo(models.User, { foreignKey: 'reviewee_id', as: 'reviewee' });
    }
  }

  ProjectReview.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      project_id: { type: DataTypes.UUID, allowNull: false },
      reviewer_id: { type: DataTypes.UUID, allowNull: false },
      reviewee_id: { type: DataTypes.UUID, allowNull: false },
      rating: { type: DataTypes.INTEGER, allowNull: false },
      comment: DataTypes.TEXT,
      private_note: DataTypes.TEXT,
      metadata: jsonType,
      deleted_at: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'ProjectReview',
      tableName: 'project_reviews',
      underscored: true,
      paranoid: true,
    }
  );

  return ProjectReview;
};
