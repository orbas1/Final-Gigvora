'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');

module.exports = (sequelize) => {
  class Session extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }

  Session.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuid(),
        primaryKey: true,
      },
      user_agent: DataTypes.STRING,
      ip_address: DataTypes.STRING,
      refresh_token_hash: DataTypes.STRING,
      expires_at: DataTypes.DATE,
      revoked_at: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'Session',
      tableName: 'sessions',
    }
  );

  return Session;
};
