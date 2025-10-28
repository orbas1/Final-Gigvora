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
      subject_type: { type: DataTypes.ENUM('user', 'org'), allowNull: false },
      subject_id: { type: DataTypes.UUID, allowNull: false },
      status: {
        type: DataTypes.ENUM('pending', 'verified', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
      },
      provider: { type: DataTypes.STRING },
      provider_reference: { type: DataTypes.STRING },
      review_notes: { type: DataTypes.TEXT },
      decision_reason: { type: DataTypes.STRING },
      reviewed_at: { type: DataTypes.DATE },
      verified_at: { type: DataTypes.DATE },
      rejected_at: { type: DataTypes.DATE },
      data: { type: DataTypes.JSONB || DataTypes.JSON, defaultValue: {} },
    },
    {
      sequelize,
      modelName: 'VerificationRequest',
      tableName: 'verification_requests',
      underscored: true,
      paranoid: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
      defaultScope: {
        attributes: { exclude: ['deleted_at'] },
      },
      scopes: {
        withDeleted: { paranoid: false },
      },
      indexes: [
        { fields: ['subject_type', 'subject_id', 'status'] },
        { fields: ['provider_reference'] },
      ],
    }
  );

  return VerificationRequest;
};
