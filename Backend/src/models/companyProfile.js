'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class CompanyProfile extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'owner_user_id', as: 'owner' });
    }
  }

  CompanyProfile.init(
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
      legal_name: DataTypes.STRING,
      brand_name: DataTypes.STRING,
      overview: DataTypes.TEXT,
      website: DataTypes.STRING,
      industry: DataTypes.STRING,
      team_size: DataTypes.INTEGER,
      headquarters: DataTypes.STRING,
      hiring_needs: DataTypes.JSONB || DataTypes.JSON,
      benefits: DataTypes.JSONB || DataTypes.JSON,
    },
    {
      sequelize,
      modelName: 'CompanyProfile',
      tableName: 'company_profiles',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      paranoid: true,
      deletedAt: 'deleted_at',
    }
  );

  return CompanyProfile;
};
