'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class ProfileView extends Model {
    static associate(models) {
      this.belongsTo(models.Profile, { foreignKey: 'profile_id', as: 'profile' });
      this.belongsTo(models.User, { foreignKey: 'viewer_id', as: 'viewer' });
    }
  }

  ProfileView.init(
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
      viewer_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      source: DataTypes.STRING,
      viewed_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      modelName: 'ProfileView',
      tableName: 'profile_views',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  return ProfileView;
};
