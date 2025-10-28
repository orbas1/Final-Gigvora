'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');

module.exports = (sequelize) => {
  class JobTag extends Model {
    static associate(models) {
      this.belongsTo(models.Job, { foreignKey: 'job_id', as: 'job' });
    }
  }

  JobTag.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuid(),
        primaryKey: true,
      },
      job_id: {
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
      modelName: 'JobTag',
      tableName: 'job_tags',
      paranoid: false,
    }
  );

  return JobTag;
};
