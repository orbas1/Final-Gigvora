'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');
const { jsonColumn, enumColumn } = require('./helpers/columnTypes');

module.exports = (sequelize) => {
  class ProjectBid extends Model {
    static associate(models) {
      this.belongsTo(models.Project, { foreignKey: 'project_id', as: 'project' });
      this.belongsTo(models.User, { foreignKey: 'bidder_id', as: 'bidder' });
    }
  }

  ProjectBid.init(
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
      bidder_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      currency: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'USD',
      },
      bid_type: enumColumn(sequelize, DataTypes, ['fixed', 'hourly'], {
        allowNull: false,
        defaultValue: 'fixed',
      }),
      hourly_rate: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      proposed_hours: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      cover_letter: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      attachments: jsonColumn(sequelize, DataTypes, { allowNull: true }),
      status: enumColumn(sequelize, DataTypes, ['pending', 'accepted', 'rejected', 'withdrawn'], {
        allowNull: false,
        defaultValue: 'pending',
      }),
      estimated_days: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      submitted_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      decision_at: {
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
      modelName: 'ProjectBid',
      tableName: 'project_bids',
      paranoid: true,
      indexes: [
        { fields: ['project_id'] },
        { fields: ['bidder_id'] },
        { fields: ['status'] },
      ],
    }
  );

  return ProjectBid;
};
