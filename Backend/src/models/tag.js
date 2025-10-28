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
      this.belongsToMany(models.Group, {
        through: models.GroupTag,
        foreignKey: 'tag_id',
        otherKey: 'group_id',
        as: 'groups',
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
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      paranoid: true,
      deletedAt: 'deleted_at',
    }
  );

  return Tag;
};
