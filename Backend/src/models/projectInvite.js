'use strict';

const { Model, DataTypes } = require('sequelize');
const { getJsonType } = require('../utils/sequelize');

module.exports = (sequelize) => {
  const jsonType = getJsonType(sequelize, DataTypes);
  class ProjectInvite extends Model {
    static associate(models) {
      this.belongsTo(models.Project, { foreignKey: 'project_id', as: 'project' });
      this.belongsTo(models.User, { foreignKey: 'freelancer_id', as: 'freelancer' });
      this.belongsTo(models.User, { foreignKey: 'inviter_id', as: 'inviter' });
    }
  }

  ProjectInvite.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      project_id: { type: DataTypes.UUID, allowNull: false },
      inviter_id: { type: DataTypes.UUID, allowNull: false },
      freelancer_id: { type: DataTypes.UUID, allowNull: false },
      message: DataTypes.TEXT,
      status: {
        type: DataTypes.ENUM('pending', 'accepted', 'declined', 'expired'),
        allowNull: false,
        defaultValue: 'pending',
      },
      responded_at: DataTypes.DATE,
      metadata: jsonType,
    },
    {
      sequelize,
      modelName: 'ProjectInvite',
      tableName: 'project_invites',
      underscored: true,
    }
  );

  return ProjectInvite;
};
