module.exports = (sequelize, DataTypes) => {
  const Organization = sequelize.define(
    'Organization',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
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
      type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      owner_id: {
        type: DataTypes.UUID,
      },
      status: {
        type: DataTypes.STRING,
        defaultValue: 'active',
      },
      verified_at: {
        type: DataTypes.DATE,
      },
      metadata: {
        type: DataTypes.JSON,
      },
      merged_into_id: {
        type: DataTypes.UUID,
      },
    },
    {
      tableName: 'organizations',
    }
  );

  Organization.associate = (models) => {
    Organization.belongsTo(models.User, { foreignKey: 'owner_id', as: 'owner' });
    Organization.hasMany(models.Job, { foreignKey: 'org_id', as: 'jobs' });
    Organization.belongsTo(models.Organization, { foreignKey: 'merged_into_id', as: 'mergedInto' });
  };

  return Organization;
};
