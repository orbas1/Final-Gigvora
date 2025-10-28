'use strict';

const { Model, DataTypes } = require('sequelize');
const { enumColumn } = require('./helpers/columnTypes');

module.exports = (sequelize) => {
  class Connection extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'requester_id', as: 'requester' });
      this.belongsTo(models.User, { foreignKey: 'addressee_id', as: 'addressee' });
    }
  }

  Connection.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      requester_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      addressee_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      status: enumColumn(sequelize, DataTypes, ['pending', 'accepted', 'rejected'], {
        defaultValue: 'pending',
      }),
      note: DataTypes.TEXT,
      responded_at: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'Connection',
      tableName: 'connections',
      indexes: [
        {
          name: 'connections_unique_pair',
          unique: true,
          fields: ['requester_id', 'addressee_id', 'deleted_at'],
        },
        {
          name: 'connections_requester_status_idx',
          fields: ['requester_id', 'status'],
        },
        {
          name: 'connections_addressee_status_idx',
          fields: ['addressee_id', 'status'],
        },
        {
          name: 'connections_created_at_idx',
          fields: ['created_at'],
        },
      ],
    }
  );

  return Connection;
};
