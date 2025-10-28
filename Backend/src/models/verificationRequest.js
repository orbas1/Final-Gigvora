'use strict';

const { Model, DataTypes } = require('sequelize');
const { getJsonType } = require('../utils/sequelize');

module.exports = (sequelize) => {
  const jsonType = getJsonType(sequelize, DataTypes);
  class VerificationRequest extends Model {}

  VerificationRequest.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      subject_type: DataTypes.ENUM('user', 'org'),
      subject_id: DataTypes.UUID,
      status: DataTypes.ENUM('pending', 'verified', 'rejected'),
      data: jsonType,
    },
    {
      sequelize,
      modelName: 'VerificationRequest',
      tableName: 'verification_requests',
    }
  );

  return VerificationRequest;
};
