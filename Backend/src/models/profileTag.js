'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class ProfileTag extends Model {}

  ProfileTag.init(
    {
      profile_id: {
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
      modelName: 'ProfileTag',
      tableName: 'profile_tags',
    }
  );

  return ProfileTag;
};
