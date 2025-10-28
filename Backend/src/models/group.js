'use strict';

const { Model, DataTypes } = require('sequelize');

const listToString = (value) => {
  if (!value) return null;
  if (Array.isArray(value)) {
    return value
      .map((entry) => entry && String(entry).trim())
      .filter(Boolean)
      .join(',');
  }
  return value;
};

const stringToList = (value) => {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

module.exports = (sequelize) => {
  class Group extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'owner_id', as: 'owner' });
    }
  }

  Group.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      owner_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING,
        unique: true,
      },
      description: DataTypes.TEXT,
      privacy: {
        type: DataTypes.ENUM('public', 'private'),
        allowNull: false,
        defaultValue: 'public',
      },
      location: DataTypes.STRING,
      tags: {
        type: DataTypes.TEXT,
        get() {
          return stringToList(this.getDataValue('tags'));
        },
        set(value) {
          this.setDataValue('tags', listToString(value));
        },
      },
      member_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      analytics_snapshot: DataTypes.JSONB || DataTypes.JSON,
    },
    {
      sequelize,
      modelName: 'Group',
      tableName: 'groups',
    }
  );

  return Group;
};
