'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');
const { jsonField } = require('../utils/sequelize');

module.exports = (sequelize) => {
  class AdminAuditLog extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'actor_id', as: 'actor' });
    }
  }

  AdminAuditLog.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuid(),
        primaryKey: true,
      },
      actor_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      actor_role: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      entity_type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      entity_id: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      action: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      changes: jsonField(sequelize, DataTypes, 'changes'),
      metadata: jsonField(sequelize, DataTypes, 'metadata'),
    },
    {
      sequelize,
      modelName: 'AdminAuditLog',
      tableName: 'admin_audit_logs',
      updatedAt: false,
      createdAt: 'created_at',
    }
  );

  return AdminAuditLog;
};
