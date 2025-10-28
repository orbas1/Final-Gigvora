'use strict';

const { v4: uuid } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  const NetworkingSessionFeedback = sequelize.define(
    'NetworkingSessionFeedback',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuid(),
        primaryKey: true,
      },
      session_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      stars: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
          max: 5,
        },
      },
      note: {
        type: DataTypes.TEXT,
      },
    },
    {
      tableName: 'networking_session_feedback',
      underscored: true,
    }
  );

  NetworkingSessionFeedback.associate = (models) => {
    NetworkingSessionFeedback.belongsTo(models.NetworkingSession, { as: 'session', foreignKey: 'session_id' });
    NetworkingSessionFeedback.belongsTo(models.User, { as: 'author', foreignKey: 'user_id' });
  };

  return NetworkingSessionFeedback;
};
