'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class SuggestionEvent extends Model {
    static associate(models) {
      this.belongsTo(models.Suggestion, { foreignKey: 'suggestion_id', as: 'suggestion' });
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }

  SuggestionEvent.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      suggestion_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      event_type: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isIn: [['impression', 'click', 'dismiss', 'save']],
        },
      },
      occurred_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      context: DataTypes.JSONB || DataTypes.JSON,
    },
    {
      sequelize,
      modelName: 'SuggestionEvent',
      tableName: 'suggestion_events',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      paranoid: false,
    }
  );

  SuggestionEvent.EVENT_TYPES = ['impression', 'click', 'dismiss', 'save'];

  return SuggestionEvent;
};
