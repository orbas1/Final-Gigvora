'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');
const { jsonColumn, enumColumn } = require('./helpers/columnTypes');

module.exports = (sequelize) => {
  class GigPackage extends Model {
    static associate(models) {
      this.belongsTo(models.Gig, { foreignKey: 'gig_id', as: 'gig' });
      this.hasMany(models.GigOrder, { foreignKey: 'package_id', as: 'orders' });
    }
  }

  GigPackage.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuid(),
        primaryKey: true,
      },
      gig_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      tier: enumColumn(sequelize, DataTypes, ['basic', 'standard', 'premium'], { allowNull: false }),
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      price: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
      currency: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'USD',
      },
      delivery_days: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      revisions: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      features: jsonColumn(sequelize, DataTypes, { allowNull: true }),
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      sequelize,
      modelName: 'GigPackage',
      tableName: 'gig_packages',
      paranoid: false,
      timestamps: true,
      indexes: [{ unique: true, fields: ['gig_id', 'tier'] }],
    }
  );

  return GigPackage;
};
