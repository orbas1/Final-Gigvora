'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');
const { enumColumn } = require('./helpers/columnTypes');

module.exports = (sequelize) => {
  class ProjectInvite extends Model {
    static associate(models) {
      this.belongsTo(models.Project, { foreignKey: 'project_id', as: 'project' });
      this.belongsTo(models.User, { foreignKey: 'inviter_id', as: 'inviter' });
      this.belongsTo(models.User, { foreignKey: 'invitee_id', as: 'invitee' });
    }
  }

  ProjectInvite.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuid(),
        primaryKey: true,
      },
      project_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      inviter_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      invitee_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      status: enumColumn(sequelize, DataTypes, ['pending', 'accepted', 'declined', 'revoked'], {
        allowNull: false,
        defaultValue: 'pending',
      }),
      message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      responded_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'ProjectInvite',
      tableName: 'project_invites',
      paranoid: true,
      indexes: [
        { fields: ['project_id'] },
        { fields: ['invitee_id'] },
        { unique: true, fields: ['project_id', 'invitee_id'] },
      ],
    }
  );

  return ProjectInvite;
};
