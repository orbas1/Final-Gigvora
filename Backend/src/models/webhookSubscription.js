'use strict';

const { Model, DataTypes } = require('sequelize');
const { jsonColumn } = require('./helpers/columnTypes');

module.exports = (sequelize) => {
  class WebhookSubscription extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'owner_id', as: 'owner' });
      this.hasMany(models.WebhookDelivery, { foreignKey: 'subscription_id', as: 'deliveries' });
    }

    isActive() {
      return this.status === 'active' && !this.deleted_at;
    }
  }

  const jsonType = sequelize.getDialect() === 'postgres' ? DataTypes.JSONB : DataTypes.JSON;

  WebhookSubscription.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: DataTypes.STRING,
      url: DataTypes.STRING,
      events: jsonColumn(sequelize, DataTypes),
      owner_id: { type: DataTypes.UUID },
      name: { type: DataTypes.STRING, allowNull: false },
      url: { type: DataTypes.STRING, allowNull: false },
      events: { type: jsonType, allowNull: false, defaultValue: [] },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'active' },
      signing_secret_hash: { type: DataTypes.STRING },
      signing_secret_last4: { type: DataTypes.STRING },
      delivery_attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      last_delivery_at: DataTypes.DATE,
      last_failure_at: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'WebhookSubscription',
      tableName: 'webhook_subscriptions',
      paranoid: true,
      defaultScope: {
        attributes: { exclude: ['signing_secret_hash'] },
      },
    }
  );

  return WebhookSubscription;
};
