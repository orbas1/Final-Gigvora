'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class FreelancerProfile extends Model {
    static associate(models) {
      this.belongsTo(models.Profile, { foreignKey: 'profile_id', as: 'profile' });
    }
  }

  FreelancerProfile.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      profile_id: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
      },
      headline: DataTypes.STRING,
      specialties: DataTypes.JSONB || DataTypes.JSON,
      availability_status: {
        type: DataTypes.ENUM('available', 'limited', 'unavailable'),
        defaultValue: 'available',
      },
      available_hours_per_week: DataTypes.INTEGER,
      languages: DataTypes.JSONB || DataTypes.JSON,
      rate_card: DataTypes.JSONB || DataTypes.JSON,
      certifications: DataTypes.JSONB || DataTypes.JSON,
      verified_at: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'FreelancerProfile',
      tableName: 'freelancer_profiles',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      paranoid: true,
      deletedAt: 'deleted_at',
    }
  );

  return FreelancerProfile;
};
