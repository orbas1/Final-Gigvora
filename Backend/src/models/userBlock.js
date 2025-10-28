'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class UserBlock extends Model {}

  UserBlock.init(
    {
      blocker_id: {
        type: DataTypes.UUID,
        primaryKey: true,
      },
      blocked_id: {
        type: DataTypes.UUID,
        primaryKey: true,
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      modelName: 'UserBlock',
      tableName: 'user_blocks',
      updatedAt: false,
    }
  );

  return UserBlock;
};
