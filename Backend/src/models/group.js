'use strict';

const { Model, DataTypes } = require('sequelize');
const { jsonColumn, enumColumn } = require('./helpers/columnTypes');

module.exports = (sequelize) => {
  class Group extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'created_by', as: 'owner' });
      this.hasMany(models.GroupMember, { foreignKey: 'group_id', as: 'memberships' });
      this.belongsToMany(models.User, {
        through: models.GroupMember,
        foreignKey: 'group_id',
        otherKey: 'user_id',
        as: 'members',
      });
      this.belongsToMany(models.Tag, {
        through: models.GroupTag,
        foreignKey: 'group_id',
        otherKey: 'tag_id',
        as: 'tags',
      });
      this.hasMany(models.Post, { foreignKey: 'group_id', as: 'posts' });
    }
  }

  Group.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      description: DataTypes.TEXT,
      visibility: enumColumn(sequelize, DataTypes, ['public', 'private'], {
        allowNull: false,
        defaultValue: 'public',
      }),
      cover_image_url: DataTypes.STRING,
      metadata: jsonColumn(sequelize, DataTypes, { allowNull: true }),
      created_by: {
        type: DataTypes.UUID,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'Group',
      tableName: 'groups',
      paranoid: true,
    }
  );

  return Group;
};
