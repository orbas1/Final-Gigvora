'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class AgencyProfile extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'owner_user_id', as: 'owner' });
    }
  }

  AgencyProfile.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      org_id: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
      },
      owner_user_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      name: DataTypes.STRING,
      overview: DataTypes.TEXT,
      website: DataTypes.STRING,
      timezone: DataTypes.STRING,
      social_links: DataTypes.JSONB || DataTypes.JSON,
      rate_card: DataTypes.JSONB || DataTypes.JSON,
      metrics_snapshot: DataTypes.JSONB || DataTypes.JSON,
      deleted_at: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'AgencyProfile',
      tableName: 'agency_profiles',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      paranoid: true,
      deletedAt: 'deleted_at',
    }
  );

  return AgencyProfile;
};
