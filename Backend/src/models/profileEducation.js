'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class ProfileEducation extends Model {
    static associate(models) {
      this.belongsTo(models.Profile, { foreignKey: 'profile_id', as: 'profile' });
    }
  }

  ProfileEducation.init(
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
      school: DataTypes.STRING,
      degree: DataTypes.STRING,
      field: DataTypes.STRING,
      start_date: DataTypes.DATE,
      end_date: DataTypes.DATE,
      description: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: 'ProfileEducation',
      tableName: 'profile_education',
    }
  );

  return ProfileEducation;
};
