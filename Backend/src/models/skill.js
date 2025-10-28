'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Skill extends Model {
    static associate(models) {
      this.belongsToMany(models.Profile, {
        through: models.ProfileSkill,
        foreignKey: 'skill_id',
        otherKey: 'profile_id',
        as: 'profiles',
      });
    }
  }

  Skill.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        unique: true,
      },
      description: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: 'Skill',
      tableName: 'skills',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      paranoid: true,
      deletedAt: 'deleted_at',
    }
  );

  return Skill;
};
