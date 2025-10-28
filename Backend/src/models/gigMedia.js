'use strict';

const { Model, DataTypes } = require('sequelize');
const { getJsonType } = require('../utils/sequelize');

module.exports = (sequelize) => {
  const jsonType = getJsonType(sequelize, DataTypes);
  class GigMedia extends Model {
    static associate(models) {
      this.belongsTo(models.Gig, { foreignKey: 'gig_id', as: 'gig' });
    }
  }

  GigMedia.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      gig_id: { type: DataTypes.UUID, allowNull: false },
      type: { type: DataTypes.ENUM('image', 'video', 'document'), allowNull: false, defaultValue: 'image' },
      url: { type: DataTypes.STRING, allowNull: false },
      sort_order: DataTypes.INTEGER,
      metadata: jsonType,
    },
    {
      sequelize,
      modelName: 'GigMedia',
      tableName: 'gig_media',
      underscored: true,
    }
  );

  return GigMedia;
};
