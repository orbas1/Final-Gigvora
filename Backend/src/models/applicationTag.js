'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');

module.exports = (sequelize) => {
  class ApplicationTag extends Model {
    static associate(models) {
      this.belongsTo(models.JobApplication, { foreignKey: 'application_id', as: 'application' });
    }
  }

  ApplicationTag.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuid(),
        primaryKey: true,
      },
      application_id: {
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
      modelName: 'ApplicationTag',
      tableName: 'application_tags',
      paranoid: false,
    }
  );

  return ApplicationTag;
};
