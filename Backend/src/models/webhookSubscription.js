'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class WebhookSubscription extends Model {}

  WebhookSubscription.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: DataTypes.STRING,
      url: DataTypes.STRING,
      events: DataTypes.JSONB || DataTypes.JSON,
    },
    {
      sequelize,
      modelName: 'WebhookSubscription',
      tableName: 'webhook_subscriptions',
    }
  );

  return WebhookSubscription;
};
