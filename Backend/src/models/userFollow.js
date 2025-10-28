'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class UserFollow extends Model {}

  UserFollow.init(
    {
      follower_id: {
        type: DataTypes.UUID,
        primaryKey: true,
      },
      followee_id: {
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
      modelName: 'UserFollow',
      tableName: 'user_follows',
      updatedAt: false,
    }
  );

  return UserFollow;
};
