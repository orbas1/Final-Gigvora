module.exports = (sequelize, DataTypes) => {
  const PlatformMetric = sequelize.define(
    'PlatformMetric',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      metric: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      value: {
        type: DataTypes.DECIMAL(20, 4),
        allowNull: false,
      },
      recorded_for: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      dimension: {
        type: DataTypes.STRING,
      },
      metadata: {
        type: DataTypes.JSON,
      },
    },
    {
      tableName: 'platform_metrics',
      updatedAt: false,
    }
  );

  return PlatformMetric;
};
