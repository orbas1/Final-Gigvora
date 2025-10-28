module.exports = (sequelize, DataTypes) => {
  const ContentReport = sequelize.define(
    'ContentReport',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      reporter_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      subject_type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      subject_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      reason: {
        type: DataTypes.STRING,
      },
      details: {
        type: DataTypes.TEXT,
      },
      status: {
        type: DataTypes.STRING,
        defaultValue: 'pending',
      },
      action_taken: {
        type: DataTypes.STRING,
      },
      resolution_notes: {
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
      tableName: 'content_reports',
    }
  );

  ContentReport.associate = (models) => {
    ContentReport.belongsTo(models.User, { foreignKey: 'reporter_id', as: 'reporter' });
  };

  return ContentReport;
};
