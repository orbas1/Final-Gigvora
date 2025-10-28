'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class CalendarEventParticipant extends Model {
    static associate(models) {
      this.belongsTo(models.CalendarEvent, { foreignKey: 'event_id', as: 'event' });
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }

  CalendarEventParticipant.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      event_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      name: DataTypes.STRING,
      role: {
        type: DataTypes.ENUM('organizer', 'attendee'),
        defaultValue: 'attendee',
      },
      status: {
        type: DataTypes.ENUM('needs_action', 'accepted', 'declined', 'tentative'),
        defaultValue: 'needs_action',
      },
      responded_at: DataTypes.DATE,
      metadata: DataTypes.JSONB || DataTypes.JSON,
    },
    {
      sequelize,
      modelName: 'CalendarEventParticipant',
      tableName: 'calendar_event_participants',
    }
  );

  return CalendarEventParticipant;
};
