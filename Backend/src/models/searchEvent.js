'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');
const { jsonField } = require('../utils/sequelize');

module.exports = (sequelize) => {
  class SearchEvent extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }

  SearchEvent.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuid(),
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      query: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      results_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      zero_results: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      filters: jsonField(sequelize, DataTypes, 'filters'),
      occurred_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'SearchEvent',
      tableName: 'search_events',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  return SearchEvent;
};
