'use strict';

const { Model, DataTypes } = require('sequelize');
const { jsonColumn, enumColumn } = require('./helpers/columnTypes');

module.exports = (sequelize) => {
  class ApiToken extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }

  ApiToken.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
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
      description: DataTypes.TEXT,
      token_hash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      token_prefix: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      token_last4: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      scopes: jsonColumn(sequelize, DataTypes),
      status: enumColumn(sequelize, DataTypes, ['active', 'revoked', 'expired'], {
        allowNull: false,
        defaultValue: 'active',
      }),
      ip_allowlist: jsonColumn(sequelize, DataTypes),
      metadata: jsonColumn(sequelize, DataTypes),
      last_used_at: DataTypes.DATE,
      last_used_ip: DataTypes.STRING,
      expires_at: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'ApiToken',
      tableName: 'api_tokens',
      defaultScope: {
        attributes: { exclude: ['token_hash'] },
      },
      scopes: {
        withSecret: {},
      },
    }
  );

  return ApiToken;
};
