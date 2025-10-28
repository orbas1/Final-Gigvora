'use strict';

const { Model, DataTypes } = require('sequelize');
const { getJsonType } = require('../utils/sequelize');

module.exports = (sequelize) => {
  const jsonType = getJsonType(sequelize, DataTypes);
  class WebhookSubscription extends Model {}

  WebhookSubscription.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: DataTypes.STRING,
      url: DataTypes.STRING,
      events: jsonType,
    },
    {
      sequelize,
      modelName: 'WebhookSubscription',
      tableName: 'webhook_subscriptions',
    }
  );

  return WebhookSubscription;
};
