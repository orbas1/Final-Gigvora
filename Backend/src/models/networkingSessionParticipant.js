'use strict';

const { v4: uuid } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  const NetworkingSessionParticipant = sequelize.define(
    'NetworkingSessionParticipant',
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
      alias: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      joined_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      left_at: {
        type: DataTypes.DATE,
      },
    },
    {
      tableName: 'networking_session_participants',
      underscored: true,
    }
  );

  NetworkingSessionParticipant.associate = (models) => {
    NetworkingSessionParticipant.belongsTo(models.NetworkingSession, { as: 'session', foreignKey: 'session_id' });
    NetworkingSessionParticipant.belongsTo(models.User, { as: 'user', foreignKey: 'user_id' });
  };

  return NetworkingSessionParticipant;
};
