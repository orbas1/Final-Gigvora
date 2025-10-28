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
    }
  );

  return Connection;
};
