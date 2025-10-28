'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class FeedMetric extends Model {}

  const dialect = sequelize.getDialect();
  const jsonType = dialect === 'postgres' ? DataTypes.JSONB : DataTypes.JSON;

  FeedMetric.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      feed: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      latency_ms: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      error: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      status_code: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      error_code: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      metadata: {
        type: jsonType,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'FeedMetric',
      tableName: 'feed_metrics',
      updatedAt: 'updated_at',
      createdAt: 'created_at',
    }
  );

  return FeedMetric;
};
