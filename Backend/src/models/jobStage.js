'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');

const slugify = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 190);

module.exports = (sequelize) => {
  class JobStage extends Model {
    static associate(models) {
      this.belongsTo(models.Job, { foreignKey: 'job_id', as: 'job' });
      this.hasMany(models.JobApplication, { foreignKey: 'stage_id', as: 'applications' });
    }
  }

  JobStage.init(
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
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      order_index: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      is_default: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      auto_advance_days: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'JobStage',
      tableName: 'job_stages',
      paranoid: true,
      defaultScope: {
        order: [['order_index', 'ASC']],
      },
      hooks: {
        beforeValidate(stage) {
          if (stage.name && !stage.slug) {
            stage.slug = slugify(stage.name);
          }
        },
        beforeSave(stage) {
          if (stage.changed('name')) {
            stage.slug = slugify(stage.name);
          }
        },
      },
    }
  );

  return JobStage;
};
