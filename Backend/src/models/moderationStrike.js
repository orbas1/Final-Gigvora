module.exports = (sequelize, DataTypes) => {
  const ModerationStrike = sequelize.define(
    'ModerationStrike',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      reason: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      severity: {
        type: DataTypes.STRING,
        defaultValue: 'minor',
      },
      status: {
        type: DataTypes.STRING,
        defaultValue: 'active',
      },
      issued_by: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      expires_at: {
        type: DataTypes.DATE,
      },
      metadata: {
        type: DataTypes.JSON,
      },
    },
    {
      tableName: 'moderation_strikes',
    }
  );

  ModerationStrike.associate = (models) => {
    ModerationStrike.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    ModerationStrike.belongsTo(models.User, { foreignKey: 'issued_by', as: 'issuedBy' });
  };

  return ModerationStrike;
};
