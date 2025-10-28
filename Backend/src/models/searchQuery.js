'use strict';

const { Model, DataTypes } = require('sequelize');
const { jsonColumn, enumColumn } = require('./helpers/columnTypes');

const SEARCH_TYPES = ['people', 'freelancers', 'agencies', 'companies', 'projects', 'gigs', 'jobs', 'groups'];

module.exports = (sequelize) => {
  class SearchQuery extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }

  SearchQuery.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      search_type: enumColumn(sequelize, DataTypes, SEARCH_TYPES, {
        allowNull: false,
      }),
      query: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      filters: jsonColumn(sequelize, DataTypes),
      results_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      analytics_snapshot: jsonColumn(sequelize, DataTypes),
      executed_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      duration_ms: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      request_ip: {
        type: DataTypes.STRING,
      },
      user_agent: {
        type: DataTypes.TEXT,
      },
    },
    {
      sequelize,
      modelName: 'SearchQuery',
      tableName: 'search_queries',
      underscored: true,
      timestamps: true,
      paranoid: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
    }
  );

  SearchQuery.TYPES = SEARCH_TYPES;

  return SearchQuery;
};
