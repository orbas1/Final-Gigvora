'use strict';

const { v4: uuid } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  const LiveSignal = sequelize.define(
    'LiveSignal',
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
      sender_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      target_id: {
        type: DataTypes.UUID,
      },
      signal_type: {
        type: DataTypes.ENUM('offer', 'answer', 'ice'),
        allowNull: false,
      },
      payload: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      delivered_at: {
        type: DataTypes.DATE,
      },
      expires_at: {
        type: DataTypes.DATE,
      },
    },
    {
      tableName: 'live_signals',
      underscored: true,
    }
  );

  LiveSignal.associate = (models) => {
    LiveSignal.belongsTo(models.NetworkingSession, { as: 'session', foreignKey: 'session_id' });
    LiveSignal.belongsTo(models.User, { as: 'sender', foreignKey: 'sender_id' });
    LiveSignal.belongsTo(models.User, { as: 'target', foreignKey: 'target_id' });
  };

  return LiveSignal;
};
