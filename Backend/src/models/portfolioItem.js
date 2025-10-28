'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class PortfolioItem extends Model {
    static associate(models) {
      this.belongsTo(models.Profile, { foreignKey: 'profile_id', as: 'profile' });
    }
  }

  PortfolioItem.init(
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
      title: DataTypes.STRING,
      description: DataTypes.TEXT,
      url: DataTypes.STRING,
      media: DataTypes.JSONB || DataTypes.JSON,
    },
    {
      sequelize,
      modelName: 'PortfolioItem',
      tableName: 'portfolio_items',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      paranoid: true,
      deletedAt: 'deleted_at',
    }
  );

  return PortfolioItem;
};
