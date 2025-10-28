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
  class Job extends Model {
    static associate(models) {
      this.belongsTo(models.Organization, { foreignKey: 'company_id', as: 'company' });
    }
  }

  Job.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      company_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING,
        unique: true,
      },
      description: DataTypes.TEXT,
      employment_type: {
        type: DataTypes.ENUM('full_time', 'part_time', 'contract', 'temporary', 'internship'),
        allowNull: false,
        defaultValue: 'full_time',
      },
      location: DataTypes.STRING,
      remote: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      salary_min: DataTypes.DECIMAL,
      salary_max: DataTypes.DECIMAL,
      currency: DataTypes.STRING,
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
      status: {
        type: DataTypes.ENUM('draft', 'open', 'closed', 'archived'),
        allowNull: false,
        defaultValue: 'open',
      },
      posted_at: DataTypes.DATE,
      analytics_snapshot: DataTypes.JSONB || DataTypes.JSON,
    },
    {
      sequelize,
      modelName: 'Job',
      tableName: 'jobs',
    }
  );

  return Job;
};
