'use strict';

const { Model, DataTypes } = require('sequelize');
const { getJsonType } = require('../utils/sequelize');

module.exports = (sequelize) => {
  const jsonType = getJsonType(sequelize, DataTypes);
  class ProjectMilestone extends Model {
    static associate(models) {
      this.belongsTo(models.Project, { foreignKey: 'project_id', as: 'project' });
      this.hasMany(models.ProjectDeliverable, { foreignKey: 'milestone_id', as: 'deliverables' });
    }
  }

  ProjectMilestone.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      project_id: { type: DataTypes.UUID, allowNull: false },
      title: { type: DataTypes.STRING, allowNull: false },
      description: DataTypes.TEXT,
      amount: DataTypes.DECIMAL,
      currency: { type: DataTypes.STRING, defaultValue: 'USD' },
      due_date: DataTypes.DATE,
      status: {
        type: DataTypes.ENUM('pending', 'funded', 'released', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending',
      },
      sequence: DataTypes.INTEGER,
      released_at: DataTypes.DATE,
      metadata: jsonType,
      deleted_at: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'ProjectMilestone',
      tableName: 'project_milestones',
      underscored: true,
      paranoid: true,
    }
  );

  return ProjectMilestone;
};
