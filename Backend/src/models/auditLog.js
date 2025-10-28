module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define(
    'AuditLog',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      actor_id: {
        type: DataTypes.UUID,
      },
      actor_type: {
        type: DataTypes.STRING,
      },
      entity_type: {
        type: DataTypes.STRING,
      },
      entity_id: {
        type: DataTypes.UUID,
      },
      action: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      metadata: {
        type: DataTypes.JSON,
      },
    },
    {
      tableName: 'audit_logs',
      updatedAt: false,
    }
  );

  AuditLog.associate = (models) => {
    AuditLog.belongsTo(models.User, { foreignKey: 'actor_id', as: 'actor' });
  };

  return AuditLog;
};
