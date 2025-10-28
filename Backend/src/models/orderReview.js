'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class OrderReview extends Model {
    static associate(models) {
      this.belongsTo(models.GigOrder, { foreignKey: 'order_id', as: 'order' });
      this.belongsTo(models.User, { foreignKey: 'reviewer_id', as: 'reviewer' });
      this.belongsTo(models.User, { foreignKey: 'reviewee_id', as: 'reviewee' });
    }
  }

  OrderReview.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      order_id: { type: DataTypes.UUID, allowNull: false },
      reviewer_id: { type: DataTypes.UUID, allowNull: false },
      reviewee_id: { type: DataTypes.UUID, allowNull: false },
      rating: { type: DataTypes.INTEGER, allowNull: false },
      comment: DataTypes.TEXT,
      metadata: DataTypes.JSONB || DataTypes.JSON,
      deleted_at: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'OrderReview',
      tableName: 'order_reviews',
      underscored: true,
      paranoid: true,
    }
  );

  return OrderReview;
};
