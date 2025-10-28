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
  class Project extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'client_id', as: 'client' });
      this.belongsTo(models.Organization, { foreignKey: 'organization_id', as: 'organization' });
    }
  }

  Project.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      client_id: {
        type: DataTypes.UUID,
      },
      organization_id: {
        type: DataTypes.UUID,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      summary: DataTypes.STRING,
      description: DataTypes.TEXT,
      type: {
        type: DataTypes.ENUM('fixed', 'hourly'),
        allowNull: false,
        defaultValue: 'fixed',
      },
      status: {
        type: DataTypes.ENUM('draft', 'open', 'in_progress', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'draft',
      },
      budget_min: DataTypes.DECIMAL,
      budget_max: DataTypes.DECIMAL,
      currency: DataTypes.STRING,
      location: DataTypes.STRING,
      skills: {
        type: DataTypes.TEXT,
        get() {
          return stringToList(this.getDataValue('skills'));
        },
        set(value) {
          this.setDataValue('skills', listToString(value));
        },
      },
      tags: {
        type: DataTypes.TEXT,
        get() {
          return stringToList(this.getDataValue('tags'));
        },
        set(value) {
          this.setDataValue('tags', listToString(value));
        },
      },
      published_at: DataTypes.DATE,
      analytics_snapshot: DataTypes.JSONB || DataTypes.JSON,
    },
    {
      sequelize,
      modelName: 'Project',
      tableName: 'projects',
    }
  );

  return Project;
};
