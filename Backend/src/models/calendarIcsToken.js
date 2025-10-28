'use strict';

const { Model, DataTypes } = require('sequelize');
const crypto = require('crypto');

module.exports = (sequelize) => {
  class CalendarIcsToken extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }

  CalendarIcsToken.init(
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
      token: {
        type: DataTypes.STRING(128),
        allowNull: false,
        unique: true,
        defaultValue: () => crypto.randomBytes(24).toString('hex'),
      },
      description: DataTypes.STRING,
      last_used_at: DataTypes.DATE,
      revoked_at: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'CalendarIcsToken',
      tableName: 'calendar_ics_tokens',
      defaultScope: {
        where: {
          revoked_at: null,
        },
      },
      scopes: {
        withRevoked: {},
      },
    }
  );

  return CalendarIcsToken;
};
