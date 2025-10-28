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
  class Organization extends Model {
    static associate(models) {
      this.hasMany(models.Project, { foreignKey: 'organization_id', as: 'projects' });
      this.hasMany(models.Gig, { foreignKey: 'organization_id', as: 'gigs' });
      this.hasMany(models.Job, { foreignKey: 'company_id', as: 'jobs' });
    }
  }

  Organization.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      type: {
        type: DataTypes.ENUM('company', 'agency'),
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      headline: DataTypes.STRING,
      description: DataTypes.TEXT,
      location: DataTypes.STRING,
      website: DataTypes.STRING,
      size: DataTypes.STRING,
      industry: DataTypes.STRING,
      tags: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
          return stringToList(this.getDataValue('tags'));
        },
        set(value) {
          this.setDataValue('tags', listToString(value));
        },
      },
      metadata: DataTypes.JSONB || DataTypes.JSON,
      analytics_snapshot: DataTypes.JSONB || DataTypes.JSON,
    },
    {
      sequelize,
      modelName: 'Organization',
      tableName: 'organizations',
    }
  );

  return Organization;
};
