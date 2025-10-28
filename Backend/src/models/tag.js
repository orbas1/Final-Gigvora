'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Tag extends Model {
    static associate(models) {
      this.belongsToMany(models.Profile, {
        through: models.ProfileTag,
        foreignKey: 'tag_id',
        otherKey: 'profile_id',
        as: 'profiles',
      });
    }
  }

  Tag.init(
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
      modelName: 'Tag',
      tableName: 'tags',
    }
  );

  return Tag;
};
