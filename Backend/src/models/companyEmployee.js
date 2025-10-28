'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');

module.exports = (sequelize) => {
  class CompanyEmployee extends Model {
    static associate(models) {
      this.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
      this.belongsTo(models.User, { foreignKey: 'invited_by', as: 'invitedBy' });
    }
  }

  CompanyEmployee.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuid(),
        primaryKey: true,
      },
      company_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      role: {
        type: DataTypes.ENUM('member', 'admin'),
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
      modelName: 'CompanyEmployee',
      tableName: 'company_employees',
      paranoid: true,
      indexes: [
        { unique: true, fields: ['company_id', 'user_id'] },
      ],
    }
  );

  return CompanyEmployee;
};
