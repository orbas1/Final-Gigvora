'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class GigTag extends Model {
    static associate() {}
  }

  GigTag.init(
    {
      gig_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      tag_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    },
    {
      sequelize,
      modelName: 'GigTag',
      tableName: 'gig_tags',
      underscored: true,
      timestamps: true,
    }
  );

  return GigTag;
};
