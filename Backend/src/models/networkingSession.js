'use strict';

const { v4: uuid } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  const NetworkingSession = sequelize.define(
    'NetworkingSession',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuid(),
        primaryKey: true,
      },
      lobby_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('waiting', 'active', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'waiting',
      },
      started_at: DataTypes.DATE,
      ended_at: DataTypes.DATE,
      last_activity_at: DataTypes.DATE,
      room_token: DataTypes.STRING,
      metadata: DataTypes.JSON,
    },
    {
      tableName: 'networking_sessions',
      underscored: true,
    }
  );

  NetworkingSession.associate = (models) => {
    NetworkingSession.belongsTo(models.NetworkingLobby, { as: 'lobby', foreignKey: 'lobby_id' });
    NetworkingSession.hasMany(models.NetworkingSessionParticipant, { as: 'participants', foreignKey: 'session_id' });
    NetworkingSession.hasMany(models.NetworkingSessionFeedback, { as: 'feedback', foreignKey: 'session_id' });
    NetworkingSession.hasMany(models.LiveSignal, { as: 'signals', foreignKey: 'session_id' });
  };

  return NetworkingSession;
};
