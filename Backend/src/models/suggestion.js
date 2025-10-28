'use strict';

const { Model, DataTypes } = require('sequelize');

const SURFACES = ['feed', 'people', 'groups', 'companies', 'projects', 'gigs', 'jobs'];

module.exports = (sequelize) => {
  class Suggestion extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
      this.belongsTo(models.DiscoverEntity, { foreignKey: 'entity_id', as: 'entity' });
      this.hasMany(models.SuggestionEvent, { foreignKey: 'suggestion_id', as: 'events' });
    }
  }

  Suggestion.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.UUID,
      },
      suggestion_for: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isIn: [SURFACES],
        },
      },
      entity_id: DataTypes.UUID,
      entity_type: DataTypes.STRING,
      entity_ref_id: DataTypes.UUID,
      entity_ref_type: DataTypes.STRING,
      score: {
        type: DataTypes.DECIMAL(10, 4),
        defaultValue: 0,
      },
      reason: DataTypes.STRING,
      metadata: DataTypes.JSONB || DataTypes.JSON,
      search_terms: DataTypes.TEXT,
      delivered_at: DataTypes.DATE,
      expires_at: DataTypes.DATE,
      pinned: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: 'Suggestion',
      tableName: 'suggestions',
    }
  );

  Suggestion.SURFACES = SURFACES;

  return Suggestion;
};
