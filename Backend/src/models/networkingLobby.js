'use strict';

const { v4: uuid } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  const NetworkingLobby = sequelize.define(
    'NetworkingLobby',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuid(),
        primaryKey: true,
      },
      topic: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: DataTypes.TEXT,
      duration_minutes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 2,
        validate: {
          isIn: [[2, 5]],
        },
      },
      is_paid: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      status: {
        type: DataTypes.ENUM('open', 'closed', 'draft'),
        allowNull: false,
        defaultValue: 'open',
      },
      max_participants: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 2,
      },
      created_by: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      metadata: {
        type: DataTypes.JSON,
      },
    },
    {
      tableName: 'networking_lobbies',
      underscored: true,
    }
  );

  NetworkingLobby.associate = (models) => {
    NetworkingLobby.belongsTo(models.User, { as: 'creator', foreignKey: 'created_by' });
    NetworkingLobby.hasMany(models.NetworkingSession, { as: 'sessions', foreignKey: 'lobby_id' });
  };

  return NetworkingLobby;
};
