'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class CalendarIntegration extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }

  CalendarIntegration.init(
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
      provider: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      external_account_id: DataTypes.STRING,
      access_token: DataTypes.TEXT,
      refresh_token: DataTypes.TEXT,
      expires_at: DataTypes.DATE,
      scope: DataTypes.STRING,
      settings: DataTypes.JSONB || DataTypes.JSON,
      status: {
        type: DataTypes.ENUM('connected', 'revoked', 'error'),
        allowNull: false,
        defaultValue: 'connected',
      },
      last_synced_at: DataTypes.DATE,
      revoked_at: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'CalendarIntegration',
      tableName: 'calendar_integrations',
    }
  );

  return CalendarIntegration;
};
