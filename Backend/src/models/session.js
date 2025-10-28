'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');

module.exports = (sequelize) => {
  class Session extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
      this.belongsTo(models.User, { foreignKey: 'impersonated_by', as: 'impersonator' });
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
      impersonated_by: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      impersonated_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Session',
      tableName: 'sessions',
    }
  );

  return Session;
};
