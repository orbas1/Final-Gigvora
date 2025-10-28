'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');

module.exports = (sequelize) => {
  class AgencyMember extends Model {
    static associate(models) {
      this.belongsTo(models.Agency, { foreignKey: 'agency_id', as: 'agency' });
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
      this.belongsTo(models.User, { foreignKey: 'invited_by', as: 'invitedBy' });
    }
  }

  AgencyMember.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuid(),
        primaryKey: true,
      },
      agency_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      role: {
        type: DataTypes.ENUM('member', 'lead', 'admin'),
        defaultValue: 'member',
      },
      title: {
        type: DataTypes.STRING,
      },
      invited_by: {
        type: DataTypes.UUID,
      },
      invited_at: {
        type: DataTypes.DATE,
      },
      joined_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      removed_at: {
        type: DataTypes.DATE,
      },
    },
    {
      sequelize,
      modelName: 'AgencyMember',
      tableName: 'agency_members',
      paranoid: true,
      indexes: [
        { unique: true, fields: ['agency_id', 'user_id'] },
      ],
    }
  );

  return AgencyMember;
};
