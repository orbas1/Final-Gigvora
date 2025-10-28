'use strict';

const { Model, DataTypes } = require('sequelize');
const { enumColumn } = require('./helpers/columnTypes');

module.exports = (sequelize) => {
  class GroupMember extends Model {
    static associate(models) {
      this.belongsTo(models.Group, { foreignKey: 'group_id', as: 'group' });
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }

  GroupMember.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      group_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      role: enumColumn(sequelize, DataTypes, ['member', 'mod', 'owner'], {
        allowNull: false,
        defaultValue: 'member',
      }),
      joined_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      modelName: 'GroupMember',
      tableName: 'group_members',
      paranoid: true,
    }
  );

  return GroupMember;
};
