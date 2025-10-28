'use strict';

const { Model, DataTypes } = require('sequelize');
const { getJsonType } = require('../utils/sequelize');

module.exports = (sequelize) => {
  const jsonType = getJsonType(sequelize, DataTypes);
  class Project extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'owner_id', as: 'owner' });
      this.belongsTo(models.ProjectBid, { foreignKey: 'awarded_bid_id', as: 'awardedBid' });
      this.belongsToMany(models.Tag, { through: models.ProjectTag, foreignKey: 'project_id', otherKey: 'tag_id', as: 'tags' });
      this.hasMany(models.ProjectInvite, { foreignKey: 'project_id', as: 'invites' });
      this.hasMany(models.ProjectBid, { foreignKey: 'project_id', as: 'bids' });
      this.hasMany(models.ProjectMilestone, { foreignKey: 'project_id', as: 'milestones' });
      this.hasMany(models.ProjectDeliverable, { foreignKey: 'project_id', as: 'deliverables' });
      this.hasMany(models.ProjectTimeLog, { foreignKey: 'project_id', as: 'timeLogs' });
      this.hasMany(models.ProjectReview, { foreignKey: 'project_id', as: 'reviews' });
    }
  }

  Project.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      owner_id: { type: DataTypes.UUID, allowNull: false },
      title: { type: DataTypes.STRING, allowNull: false },
      description: DataTypes.TEXT,
      type: { type: DataTypes.ENUM('fixed', 'hourly'), allowNull: false, defaultValue: 'fixed' },
      status: {
        type: DataTypes.ENUM('draft', 'open', 'in_progress', 'completed', 'cancelled', 'archived'),
        allowNull: false,
        defaultValue: 'draft',
      },
      budget_min: DataTypes.DECIMAL,
      budget_max: DataTypes.DECIMAL,
      currency: { type: DataTypes.STRING, defaultValue: 'USD' },
      location: DataTypes.STRING,
      published_at: DataTypes.DATE,
      due_date: DataTypes.DATE,
      metadata: jsonType,
      analytics_snapshot: jsonType,
    },
    {
      sequelize,
      modelName: 'Project',
      tableName: 'projects',
      underscored: true,
      paranoid: true,
    }
  );

  return Project;
};
