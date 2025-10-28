'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
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
      metadata: DataTypes.JSONB || DataTypes.JSON,
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
