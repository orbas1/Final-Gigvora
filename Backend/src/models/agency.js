'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');
const { jsonField } = require('../utils/sequelize');

module.exports = (sequelize) => {
  class Agency extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'owner_id', as: 'owner' });
      this.hasMany(models.AgencyMember, { foreignKey: 'agency_id', as: 'team' });
      this.belongsToMany(models.User, {
        through: models.AgencyMember,
        foreignKey: 'agency_id',
        otherKey: 'user_id',
        as: 'teamMembers',
      });
    }
  }

  Agency.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuid(),
        primaryKey: true,
      },
      owner_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      description: {
        type: DataTypes.TEXT,
      },
      website: {
        type: DataTypes.STRING,
        validate: { isUrl: true },
      },
      services: jsonField(sequelize, DataTypes, 'services', { defaultValue: [] }),
      specialties: jsonField(sequelize, DataTypes, 'specialties', { defaultValue: [] }),
      location: {
        type: DataTypes.STRING,
      },
      verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      verified_at: {
        type: DataTypes.DATE,
      },
      logo_url: {
        type: DataTypes.STRING,
        validate: { isUrl: true },
      },
      banner_url: {
        type: DataTypes.STRING,
        validate: { isUrl: true },
      },
      metadata: jsonField(sequelize, DataTypes, 'metadata'),
      analytics_snapshot: jsonField(sequelize, DataTypes, 'analytics_snapshot'),
    },
    {
      sequelize,
      modelName: 'Agency',
      tableName: 'agencies',
      paranoid: true,
      indexes: [
        { fields: ['name'] },
        { fields: ['verified'] },
      ],
    }
  );

  return Agency;
};
