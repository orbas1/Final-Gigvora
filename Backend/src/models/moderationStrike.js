'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');
const { jsonField } = require('../utils/sequelize');
const { enumColumn } = require('./helpers/columnTypes');

module.exports = (sequelize) => {
  class ModerationStrike extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
      this.belongsTo(models.User, { foreignKey: 'issued_by', as: 'issuer' });
    }
  }

  ModerationStrike.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuid(),
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      issued_by: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      points: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      status: enumColumn(sequelize, DataTypes, ['active', 'expired', 'revoked'], {
        allowNull: false,
        defaultValue: 'active',
      }),
      expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      resolved_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      resolution_note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      metadata: jsonField(sequelize, DataTypes, 'metadata'),
      deleted_at: {
        type: DataTypes.DATE,
      },
    },
    {
      sequelize,
      modelName: 'ModerationStrike',
      tableName: 'moderation_strikes',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      paranoid: true,
    }
  );

  return ModerationStrike;
};
