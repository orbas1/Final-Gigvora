module.exports = (sequelize, DataTypes) => {
  const Dispute = sequelize.define(
    'Dispute',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      reference_type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      reference_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      claimant_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      respondent_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING,
        defaultValue: 'open',
      },
      resolution: {
        type: DataTypes.TEXT,
      },
      resolved_at: {
        type: DataTypes.DATE,
      },
      metadata: {
        type: DataTypes.JSON,
      },
    },
    {
      tableName: 'disputes',
    }
  );

  Dispute.associate = (models) => {
    Dispute.belongsTo(models.User, { foreignKey: 'claimant_id', as: 'claimant' });
    Dispute.belongsTo(models.User, { foreignKey: 'respondent_id', as: 'respondent' });
  };

  return Dispute;
};
