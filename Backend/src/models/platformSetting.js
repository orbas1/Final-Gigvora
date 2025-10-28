module.exports = (sequelize, DataTypes) => {
  const PlatformSetting = sequelize.define(
    'PlatformSetting',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      email_templates: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
      },
      roles: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
      },
      integrations: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
      },
      updated_by: {
        type: DataTypes.UUID,
      },
    },
    {
      tableName: 'platform_settings',
    }
  );

  PlatformSetting.associate = (models) => {
    PlatformSetting.belongsTo(models.User, { foreignKey: 'updated_by', as: 'updatedBy' });
  };

  return PlatformSetting;
};
