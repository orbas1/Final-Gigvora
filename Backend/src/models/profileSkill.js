'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class ProfileSkill extends Model {}

  ProfileSkill.init(
    {
      profile_id: {
        type: DataTypes.UUID,
        primaryKey: true,
      },
      skill_id: {
        type: DataTypes.UUID,
        primaryKey: true,
      },
      proficiency: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: 'ProfileSkill',
      tableName: 'profile_skills',
    }
  );

  return ProfileSkill;
};
