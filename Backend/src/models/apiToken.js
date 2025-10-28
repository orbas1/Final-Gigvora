'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');

module.exports = (sequelize) => {
  class ApiToken extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }

  const jsonType = DataTypes.JSONB || DataTypes.JSON;

  ApiToken.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuid(),
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      token_hash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      token_prefix: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      scopes: {
        type: jsonType,
        defaultValue: () => ([]),
      },
      last_used_at: {
        type: DataTypes.DATE,
      },
      expires_at: {
        type: DataTypes.DATE,
      },
      created_by_ip: {
        type: DataTypes.STRING,
      },
      metadata: {
        type: jsonType,
        defaultValue: () => ({}),
      },
      revoked_at: {
        type: DataTypes.DATE,
      },
    },
    {
      sequelize,
      modelName: 'ApiToken',
      tableName: 'api_tokens',
    }
  );

  return ApiToken;
};
