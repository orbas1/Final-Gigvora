'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class IdempotencyKey extends Model {}

  IdempotencyKey.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      key: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      method: DataTypes.STRING,
      path: DataTypes.STRING,
      request_hash: DataTypes.STRING,
      response_body: DataTypes.JSONB || DataTypes.JSON,
      response_status: DataTypes.INTEGER,
      locked_at: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'IdempotencyKey',
      tableName: 'idempotency_keys',
    }
  );

  return IdempotencyKey;
};
