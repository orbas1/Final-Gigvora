'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');

module.exports = (sequelize) => {
  class Company extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'owner_id', as: 'owner' });
      this.hasMany(models.CompanyEmployee, { foreignKey: 'company_id', as: 'employees' });
      this.belongsToMany(models.User, {
        through: models.CompanyEmployee,
        foreignKey: 'company_id',
        otherKey: 'user_id',
        as: 'teamMembers',
      });
    }
  }

  Company.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuid(),
        primaryKey: true,
      },
      owner_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      description: {
        type: DataTypes.TEXT,
      },
      website: {
        type: DataTypes.STRING,
        validate: { isUrl: true },
      },
      industry: {
        type: DataTypes.STRING,
      },
      size: {
        type: DataTypes.ENUM('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'),
      },
      headquarters: {
        type: DataTypes.STRING,
      },
      verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      verified_at: {
        type: DataTypes.DATE,
      },
      logo_url: {
        type: DataTypes.STRING,
        validate: { isUrl: true },
      },
      banner_url: {
        type: DataTypes.STRING,
        validate: { isUrl: true },
      },
      metadata: {
        type: DataTypes.JSONB || DataTypes.JSON,
      },
      analytics_snapshot: {
        type: DataTypes.JSONB || DataTypes.JSON,
      },
    },
    {
      sequelize,
      modelName: 'Company',
      tableName: 'companies',
      paranoid: true,
      indexes: [
        { fields: ['name'] },
        { fields: ['verified'] },
      ],
    }
  );

  return Company;
};
