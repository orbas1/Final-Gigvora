'use strict';

const { Model, DataTypes } = require('sequelize');
const { getJsonType } = require('../utils/sequelize');

module.exports = (sequelize) => {
  const jsonType = getJsonType(sequelize, DataTypes);
  class GigAddon extends Model {
    static associate(models) {
      this.belongsTo(models.Gig, { foreignKey: 'gig_id', as: 'gig' });
    }
  }

  GigAddon.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      gig_id: { type: DataTypes.UUID, allowNull: false },
      title: { type: DataTypes.STRING, allowNull: false },
      description: DataTypes.TEXT,
      price: { type: DataTypes.DECIMAL, allowNull: false },
      delivery_days: DataTypes.INTEGER,
      metadata: jsonType,
      deleted_at: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'GigAddon',
      tableName: 'gig_addons',
      underscored: true,
      paranoid: true,
    }
  );

  return GigAddon;
};
