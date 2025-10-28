'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');
const { jsonColumn, enumColumn } = require('./helpers/columnTypes');

const slugify = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 190);

module.exports = (sequelize) => {
  class Gig extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'seller_id', as: 'seller' });
      this.hasMany(models.GigTag, { foreignKey: 'gig_id', as: 'tagAssignments' });
      this.hasMany(models.GigPackage, { foreignKey: 'gig_id', as: 'packages' });
      this.hasMany(models.GigAddon, { foreignKey: 'gig_id', as: 'addons' });
      this.hasMany(models.GigFaq, { foreignKey: 'gig_id', as: 'faqs' });
      this.hasMany(models.GigMedia, { foreignKey: 'gig_id', as: 'media' });
      this.hasMany(models.GigOrder, { foreignKey: 'gig_id', as: 'orders' });
      this.hasMany(models.GigReview, { foreignKey: 'gig_id', as: 'reviews' });
      this.hasMany(models.GigMetric, { foreignKey: 'gig_id', as: 'metrics' });
    }
  }

  Gig.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuid(),
        primaryKey: true,
      },
      seller_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      category: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      subcategory: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: enumColumn(sequelize, DataTypes, ['draft', 'active', 'paused', 'archived'], {
        allowNull: false,
        defaultValue: 'draft',
      }),
      price_min: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      price_max: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      currency: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'USD',
      },
      delivery_time_days: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      tags_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      orders_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      reviews_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      rating_average: {
        type: DataTypes.DECIMAL(4, 2),
        allowNull: true,
      },
      views_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      clicks_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      favorites_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      metadata: jsonColumn(sequelize, DataTypes, { allowNull: true }),
    },
    {
      sequelize,
      modelName: 'Gig',
      tableName: 'gigs',
      paranoid: true,
      indexes: [
        { fields: ['status'] },
        { fields: ['seller_id'] },
      ],
      hooks: {
        beforeValidate(gig) {
          if (gig.title && !gig.slug) {
            gig.slug = slugify(gig.title);
          }
        },
        beforeSave(gig) {
          if (gig.changed('title')) {
            gig.slug = slugify(gig.title);
          }
        },
      },
    }
  );

  return Gig;
};
