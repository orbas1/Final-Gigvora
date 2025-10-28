'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');

module.exports = (sequelize) => {
  class GigReview extends Model {
    static associate(models) {
      this.belongsTo(models.GigOrder, { foreignKey: 'order_id', as: 'order' });
      this.belongsTo(models.Gig, { foreignKey: 'gig_id', as: 'gig' });
      this.belongsTo(models.User, { foreignKey: 'reviewer_id', as: 'reviewer' });
      this.belongsTo(models.User, { foreignKey: 'reviewee_id', as: 'reviewee' });
    }
  }

  GigReview.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuid(),
        primaryKey: true,
      },
      order_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      gig_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      reviewer_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      reviewee_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      rating: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { min: 1, max: 5 },
      },
      communication_rating: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      quality_rating: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      value_rating: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      comment: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'GigReview',
      tableName: 'gig_reviews',
      paranoid: false,
      timestamps: true,
      indexes: [
        { fields: ['gig_id'] },
        { fields: ['order_id'] },
        { unique: true, fields: ['order_id', 'reviewer_id'] },
      ],
    }
  );

  return GigReview;
};
