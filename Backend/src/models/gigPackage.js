'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class GigPackage extends Model {
    static associate(models) {
      this.belongsTo(models.Gig, { foreignKey: 'gig_id', as: 'gig' });
    }
  }

  GigPackage.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      gig_id: { type: DataTypes.UUID, allowNull: false },
      tier: { type: DataTypes.ENUM('basic', 'standard', 'premium'), allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false },
      description: DataTypes.TEXT,
      price: { type: DataTypes.DECIMAL, allowNull: false },
      delivery_days: { type: DataTypes.INTEGER, allowNull: false },
      revisions: DataTypes.INTEGER,
      features: DataTypes.JSONB || DataTypes.JSON,
    },
    {
      sequelize,
      modelName: 'GigPackage',
      tableName: 'gig_packages',
      underscored: true,
    }
  );

  return GigPackage;
};
