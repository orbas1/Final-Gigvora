'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');
const { jsonColumn, enumColumn } = require('./helpers/columnTypes');

module.exports = (sequelize) => {
  class GigMedia extends Model {
    static associate(models) {
      this.belongsTo(models.Gig, { foreignKey: 'gig_id', as: 'gig' });
    }
  }

  GigMedia.init(
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
      media_type: enumColumn(sequelize, DataTypes, ['image', 'video', 'pdf'], { allowNull: false }),
      url: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      thumbnail_url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      order_index: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      metadata: jsonColumn(sequelize, DataTypes, { allowNull: true }),
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'GigMedia',
      tableName: 'gig_media',
      paranoid: true,
      timestamps: true,
      indexes: [{ fields: ['gig_id'] }],
    }
  );

  return GigMedia;
};
