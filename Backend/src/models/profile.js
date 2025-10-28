'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Profile extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
      this.hasMany(models.ProfileExperience, { foreignKey: 'profile_id', as: 'experiences' });
      this.hasMany(models.ProfileEducation, { foreignKey: 'profile_id', as: 'education' });
      this.belongsToMany(models.Skill, {
        through: models.ProfileSkill,
        foreignKey: 'profile_id',
        otherKey: 'skill_id',
        as: 'skills',
      });
      this.belongsToMany(models.Tag, {
        through: models.ProfileTag,
        foreignKey: 'profile_id',
        otherKey: 'tag_id',
        as: 'tags',
      });
      this.hasMany(models.PortfolioItem, { foreignKey: 'profile_id', as: 'portfolio' });
      this.hasMany(models.Review, {
        foreignKey: 'profile_id',
        as: 'reviews',
        scope: { subject_type: 'profile' },
      });
    }
  }

  Profile.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      display_name: DataTypes.STRING,
      headline: DataTypes.STRING,
      bio: DataTypes.TEXT,
      location: DataTypes.STRING,
      avatar_url: DataTypes.STRING,
      banner_url: DataTypes.STRING,
      socials: DataTypes.JSONB || DataTypes.JSON,
      hourly_rate: DataTypes.DECIMAL,
      currency: DataTypes.STRING,
      visibility: {
        type: DataTypes.ENUM('public', 'private', 'connections'),
        defaultValue: 'public',
      },
      analytics_snapshot: DataTypes.JSONB || DataTypes.JSON,
    },
    {
      sequelize,
      modelName: 'Profile',
      tableName: 'profiles',
    }
  );

  return Profile;
};
