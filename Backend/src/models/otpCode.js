'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class OtpCode extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }

  OtpCode.init(
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
      channel: {
        type: DataTypes.ENUM('email', 'sms'),
        defaultValue: 'email',
      },
      code: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      expires_at: DataTypes.DATE,
      consumed_at: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'OtpCode',
      tableName: 'otp_codes',
    }
  );

  return OtpCode;
};
