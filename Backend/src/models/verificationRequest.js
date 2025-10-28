'use strict';

const { Model, DataTypes } = require('sequelize');
const { jsonColumn, enumColumn } = require('./helpers/columnTypes');

module.exports = (sequelize) => {
  class VerificationRequest extends Model {}

  VerificationRequest.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      subject_type: enumColumn(sequelize, DataTypes, ['user', 'org']),
      subject_id: DataTypes.UUID,
      status: enumColumn(sequelize, DataTypes, ['pending', 'verified', 'rejected']),
      data: jsonColumn(sequelize, DataTypes),
    },
    {
      sequelize,
      modelName: 'VerificationRequest',
      tableName: 'verification_requests',
    }
  );

  return VerificationRequest;
};
