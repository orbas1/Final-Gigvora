'use strict';

const { Model, DataTypes } = require('sequelize');
const { jsonColumn } = require('./helpers/columnTypes');

module.exports = (sequelize) => {
  class Review extends Model {
    static associate(models) {
      this.belongsTo(models.Profile, { foreignKey: 'profile_id', as: 'profile' });
      this.belongsTo(models.User, { foreignKey: 'reviewer_id', as: 'reviewer' });
    }
  }

  Review.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      profile_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      reviewer_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      rating: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      comment: DataTypes.TEXT,
      metadata: jsonColumn(sequelize, DataTypes),
    },
    {
      sequelize,
      modelName: 'Review',
      tableName: 'reviews',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      paranoid: true,
      deletedAt: 'deleted_at',
    }
  );

  return Review;
};
