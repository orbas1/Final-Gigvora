module.exports = (sequelize, DataTypes) => {
  const Job = sequelize.define(
    'Job',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      org_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
      },
      status: {
        type: DataTypes.STRING,
        defaultValue: 'draft',
      },
      is_sponsored: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      is_hidden: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      published_at: {
        type: DataTypes.DATE,
      },
      budget_min: {
        type: DataTypes.DECIMAL,
      },
      budget_max: {
        type: DataTypes.DECIMAL,
      },
      currency: {
        type: DataTypes.STRING,
      },
      metadata: {
        type: DataTypes.JSON,
      },
    },
    {
      tableName: 'jobs',
    }
  );

  Job.associate = (models) => {
    Job.belongsTo(models.Organization, { foreignKey: 'org_id', as: 'organization' });
  };

  return Job;
};
