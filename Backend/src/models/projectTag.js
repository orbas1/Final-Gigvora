'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class ProjectTag extends Model {
    static associate() {}
  }

  ProjectTag.init(
    {
      project_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      tag_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    },
    {
      sequelize,
      modelName: 'ProjectTag',
      tableName: 'project_tags',
      underscored: true,
      timestamps: true,
    }
  );

  return ProjectTag;
};
