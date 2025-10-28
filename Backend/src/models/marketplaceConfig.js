'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');
const { jsonField } = require('../utils/sequelize');

module.exports = (sequelize) => {
  class MarketplaceConfig extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'updated_by', as: 'updatedBy' });
    }
  }

  MarketplaceConfig.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuid(),
        primaryKey: true,
      },
      categories: jsonField(sequelize, DataTypes, 'categories', { defaultValue: [] }),
      floor_prices: jsonField(sequelize, DataTypes, 'floor_prices', { defaultValue: {} }),
      fee_config: jsonField(sequelize, DataTypes, 'fee_config', { defaultValue: {} }),
      updated_by: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      deleted_at: {
        type: DataTypes.DATE,
      },
    },
    {
      sequelize,
      modelName: 'MarketplaceConfig',
      tableName: 'marketplace_configs',
      paranoid: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  return MarketplaceConfig;
};
