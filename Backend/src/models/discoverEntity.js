'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class DiscoverEntity extends Model {
    static associate(models) {
      this.hasMany(models.Suggestion, { foreignKey: 'entity_id', as: 'suggestions' });
    }
  }

  DiscoverEntity.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      type: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isIn: [['feed', 'people', 'groups', 'companies', 'projects', 'gigs', 'jobs']],
        },
      },
      slug: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      subtitle: DataTypes.STRING,
      description: DataTypes.TEXT,
      image_url: DataTypes.STRING,
      metadata: DataTypes.JSONB || DataTypes.JSON,
      tags: DataTypes.JSONB || DataTypes.JSON,
      metrics: DataTypes.JSONB || DataTypes.JSON,
      relevance_score: {
        type: DataTypes.DECIMAL(10, 4),
        defaultValue: 0,
      },
      search_terms: DataTypes.TEXT,
      starts_at: DataTypes.DATE,
      ends_at: DataTypes.DATE,
      status: {
        type: DataTypes.STRING,
        defaultValue: 'active',
      },
    },
    {
      sequelize,
      modelName: 'DiscoverEntity',
      tableName: 'discover_entities',
    }
  );

  return DiscoverEntity;
};
