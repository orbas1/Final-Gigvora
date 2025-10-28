'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class CalendarEvent extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'owner_id', as: 'owner' });
      this.hasMany(models.CalendarEventParticipant, { foreignKey: 'event_id', as: 'participants' });
      this.hasMany(models.CalendarEventParticipant, { foreignKey: 'event_id', as: 'participantMemberships' });
    }
  }

  CalendarEvent.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      owner_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      org_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: DataTypes.TEXT,
      location: DataTypes.STRING,
      start_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      end_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      all_day: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      visibility: {
        type: DataTypes.ENUM('private', 'team', 'public'),
        allowNull: false,
        defaultValue: 'private',
      },
      scope: {
        type: DataTypes.ENUM('user', 'org'),
        allowNull: false,
        defaultValue: 'user',
      },
      status: {
        type: DataTypes.ENUM('confirmed', 'tentative', 'cancelled'),
        allowNull: false,
        defaultValue: 'confirmed',
      },
      source: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      metadata: DataTypes.JSONB || DataTypes.JSON,
    },
    {
      sequelize,
      modelName: 'CalendarEvent',
      tableName: 'calendar_events',
    }
  );

  return CalendarEvent;
};
