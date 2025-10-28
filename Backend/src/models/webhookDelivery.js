'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class WebhookDelivery extends Model {
    static associate(models) {
      this.belongsTo(models.WebhookSubscription, { foreignKey: 'subscription_id', as: 'subscription' });
    }
  }

  const jsonType = sequelize.getDialect() === 'postgres' ? DataTypes.JSONB : DataTypes.JSON;

  WebhookDelivery.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      subscription_id: { type: DataTypes.UUID, allowNull: false },
      event: { type: DataTypes.STRING, allowNull: false },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' },
      payload: { type: jsonType },
      response_status: DataTypes.INTEGER,
      response_body: { type: jsonType },
      error_message: DataTypes.TEXT,
      retry_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      duration_ms: DataTypes.INTEGER,
      attempted_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      completed_at: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'WebhookDelivery',
      tableName: 'webhook_deliveries',
      paranoid: true,
    }
  );

  return WebhookDelivery;
};
