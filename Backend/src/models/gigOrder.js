'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class GigOrder extends Model {
    static associate(models) {
      this.belongsTo(models.Gig, { foreignKey: 'gig_id', as: 'gig' });
      this.belongsTo(models.User, { foreignKey: 'buyer_id', as: 'buyer' });
      this.belongsTo(models.User, { foreignKey: 'seller_id', as: 'seller' });
      this.hasMany(models.OrderSubmission, { foreignKey: 'order_id', as: 'submissions' });
      this.hasMany(models.OrderReview, { foreignKey: 'order_id', as: 'reviews' });
    }
  }

  GigOrder.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      gig_id: { type: DataTypes.UUID, allowNull: false },
      buyer_id: { type: DataTypes.UUID, allowNull: false },
      seller_id: { type: DataTypes.UUID, allowNull: false },
      package_tier: { type: DataTypes.ENUM('basic', 'standard', 'premium'), allowNull: false },
      price: { type: DataTypes.DECIMAL, allowNull: false },
      currency: { type: DataTypes.STRING, defaultValue: 'USD' },
      status: {
        type: DataTypes.ENUM('pending', 'in_progress', 'delivered', 'completed', 'cancelled', 'disputed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      requirements: DataTypes.TEXT,
      notes: DataTypes.TEXT,
      metadata: DataTypes.JSONB || DataTypes.JSON,
      placed_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      started_at: DataTypes.DATE,
      delivered_at: DataTypes.DATE,
      completed_at: DataTypes.DATE,
      cancelled_at: DataTypes.DATE,
      cancellation_reason: DataTypes.TEXT,
      deleted_at: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'GigOrder',
      tableName: 'gig_orders',
      underscored: true,
      paranoid: true,
    }
  );

  return GigOrder;
};
