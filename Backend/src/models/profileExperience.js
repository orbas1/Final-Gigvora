'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class ProfileExperience extends Model {
    static associate(models) {
      this.belongsTo(models.Profile, { foreignKey: 'profile_id', as: 'profile' });
    }
  }

  ProfileExperience.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      profile_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      title: DataTypes.STRING,
      company: DataTypes.STRING,
      start_date: DataTypes.DATE,
      end_date: DataTypes.DATE,
      is_current: DataTypes.BOOLEAN,
      description: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: 'ProfileExperience',
      tableName: 'profile_experiences',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      paranoid: true,
      deletedAt: 'deleted_at',
    }
  );

  return ProfileExperience;
};
