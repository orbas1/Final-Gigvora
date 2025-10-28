module.exports = (sequelize, DataTypes) => {
  const SearchQuery = sequelize.define(
    'SearchQuery',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      query: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.UUID,
      },
      results_count: {
        type: DataTypes.INTEGER,
      },
      zero_result: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      searched_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: 'search_queries',
      updatedAt: false,
    }
  );

  SearchQuery.associate = (models) => {
    SearchQuery.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  };

  return SearchQuery;
};
