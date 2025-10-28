'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');
const { jsonColumn, enumColumn } = require('./helpers/columnTypes');

module.exports = (sequelize) => {
  class GigOrder extends Model {
    static associate(models) {
      this.belongsTo(models.Gig, { foreignKey: 'gig_id', as: 'gig' });
      this.belongsTo(models.GigPackage, { foreignKey: 'package_id', as: 'package' });
      this.belongsTo(models.User, { foreignKey: 'buyer_id', as: 'buyer' });
      this.belongsTo(models.User, { foreignKey: 'seller_id', as: 'seller' });
      this.hasMany(models.GigSubmission, { foreignKey: 'order_id', as: 'submissions' });
      this.hasMany(models.GigReview, { foreignKey: 'order_id', as: 'reviews' });
    }
  }

  GigOrder.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuid(),
        primaryKey: true,
      },
      gig_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      package_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      buyer_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      seller_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      package_tier: enumColumn(sequelize, DataTypes, ['basic', 'standard', 'premium'], { allowNull: false }),
      price: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
      currency: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'USD',
      },
      status: enumColumn(
        sequelize,
        DataTypes,
        ['pending', 'requirements', 'in_progress', 'delivered', 'accepted', 'cancelled', 'refunded'],
        { allowNull: false, defaultValue: 'pending' }
      ),
      requirements: jsonColumn(sequelize, DataTypes, { allowNull: true }),
      requirements_submitted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      started_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      due_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      delivered_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      accepted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      cancelled_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      cancellation_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      source: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'GigOrder',
      tableName: 'gig_orders',
      paranoid: true,
      indexes: [
        { fields: ['gig_id'] },
        { fields: ['buyer_id'] },
        { fields: ['seller_id'] },
        { fields: ['status'] },
      ],
    }
  );

  return GigOrder;
};
