'use strict';

const { Model, DataTypes } = require('sequelize');
const slugify = require('slugify');
const { randomUUID } = require('crypto');
const { getJsonType } = require('../utils/sequelize');

module.exports = (sequelize) => {
  const jsonType = getJsonType(sequelize, DataTypes);
  class Gig extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'seller_id', as: 'seller' });
      this.belongsToMany(models.Tag, { through: models.GigTag, foreignKey: 'gig_id', otherKey: 'tag_id', as: 'tags' });
      this.hasMany(models.GigPackage, { foreignKey: 'gig_id', as: 'packages' });
      this.hasMany(models.GigAddon, { foreignKey: 'gig_id', as: 'addons' });
      this.hasMany(models.GigFaq, { foreignKey: 'gig_id', as: 'faq' });
      this.hasMany(models.GigMedia, { foreignKey: 'gig_id', as: 'media' });
      this.hasMany(models.GigOrder, { foreignKey: 'gig_id', as: 'orders' });
    }
  }

  Gig.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      seller_id: { type: DataTypes.UUID, allowNull: false },
      title: { type: DataTypes.STRING, allowNull: false },
      slug: { type: DataTypes.STRING, unique: true },
      description: DataTypes.TEXT,
      category: DataTypes.STRING,
      subcategory: DataTypes.STRING,
      status: { type: DataTypes.ENUM('draft', 'active', 'paused'), allowNull: false, defaultValue: 'draft' },
      price_min: DataTypes.DECIMAL,
      price_max: DataTypes.DECIMAL,
      currency: { type: DataTypes.STRING, defaultValue: 'USD' },
      metadata: jsonType,
      analytics_snapshot: jsonType,
    },
    {
      sequelize,
      modelName: 'Gig',
      tableName: 'gigs',
      underscored: true,
      paranoid: true,
      hooks: {
        beforeValidate: (gig) => {
          if (!gig.slug && gig.title) {
            const suffix = (gig.id || randomUUID()).slice(0, 8);
            gig.slug = slugify(`${gig.title}-${suffix}`, { lower: true, strict: true });
          }
        },
      },
    }
  );

  return Gig;
};
