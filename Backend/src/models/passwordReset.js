'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class PasswordReset extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }

  PasswordReset.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      token: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      expires_at: DataTypes.DATE,
      consumed_at: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'PasswordReset',
      tableName: 'password_resets',
    }
  );

  return PasswordReset;
};
