'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class ProjectBid extends Model {
    static associate(models) {
      this.belongsTo(models.Project, { foreignKey: 'project_id', as: 'project' });
      this.belongsTo(models.User, { foreignKey: 'bidder_id', as: 'bidder' });
    }
  }

  ProjectBid.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      project_id: { type: DataTypes.UUID, allowNull: false },
      bidder_id: { type: DataTypes.UUID, allowNull: false },
      amount: DataTypes.DECIMAL,
      currency: { type: DataTypes.STRING, defaultValue: 'USD' },
      timeline: DataTypes.STRING,
      proposal: DataTypes.TEXT,
      attachments: DataTypes.JSONB || DataTypes.JSON,
      metadata: DataTypes.JSONB || DataTypes.JSON,
      status: {
        type: DataTypes.ENUM('pending', 'accepted', 'rejected', 'withdrawn'),
        allowNull: false,
        defaultValue: 'pending',
      },
      submitted_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      responded_at: DataTypes.DATE,
      deleted_at: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'ProjectBid',
      tableName: 'project_bids',
      underscored: true,
      paranoid: true,
    }
  );

  return ProjectBid;
};
