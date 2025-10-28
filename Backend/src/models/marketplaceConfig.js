module.exports = (sequelize, DataTypes) => {
  const MarketplaceConfig = sequelize.define(
    'MarketplaceConfig',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      categories: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
      },
      floors: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
      },
      fees: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
      },
      updated_by: {
        type: DataTypes.UUID,
      },
    },
    {
      tableName: 'marketplace_configs',
    }
  );

  MarketplaceConfig.associate = (models) => {
    MarketplaceConfig.belongsTo(models.User, { foreignKey: 'updated_by', as: 'updatedBy' });
  };

  return MarketplaceConfig;
};
