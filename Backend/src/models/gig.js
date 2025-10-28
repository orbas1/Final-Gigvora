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
  class Gig extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'seller_id', as: 'seller' });
      this.belongsTo(models.Organization, { foreignKey: 'organization_id', as: 'organization' });
    }
  }

  Gig.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      seller_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      organization_id: {
        type: DataTypes.UUID,
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
      rate_amount: DataTypes.DECIMAL,
      rate_unit: {
        type: DataTypes.ENUM('fixed', 'hourly', 'package'),
        allowNull: false,
        defaultValue: 'fixed',
      },
      location: DataTypes.STRING,
      delivery_time_days: DataTypes.INTEGER,
      status: {
        type: DataTypes.ENUM('draft', 'active', 'paused', 'archived'),
        allowNull: false,
        defaultValue: 'draft',
      },
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
      analytics_snapshot: DataTypes.JSONB || DataTypes.JSON,
    },
    {
      sequelize,
      modelName: 'Gig',
      tableName: 'gigs',
    }
  );

  return Gig;
};
