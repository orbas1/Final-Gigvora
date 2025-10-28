'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');

module.exports = (sequelize) => {
  class GigTag extends Model {
    static associate(models) {
      this.belongsTo(models.Gig, { foreignKey: 'gig_id', as: 'gig' });
    }
  }

  GigTag.init(
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
      tag: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'GigTag',
      tableName: 'gig_tags',
      timestamps: true,
      paranoid: false,
      indexes: [{ unique: true, fields: ['gig_id', 'tag'] }],
    }
  );

  return GigTag;
};
