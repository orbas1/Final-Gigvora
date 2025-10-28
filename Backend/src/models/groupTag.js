'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class GroupTag extends Model {}

  GroupTag.init(
    {
      group_id: {
        type: DataTypes.UUID,
        primaryKey: true,
      },
      tag_id: {
        type: DataTypes.UUID,
        primaryKey: true,
      },
    },
    {
      sequelize,
      modelName: 'GroupTag',
      tableName: 'group_tags',
      paranoid: false,
    }
  );

  return GroupTag;
};
