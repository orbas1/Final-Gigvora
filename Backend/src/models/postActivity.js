'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class PostActivity extends Model {
    static associate(models) {
      this.belongsTo(models.Post, { foreignKey: 'post_id', as: 'post' });
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }

  const dialect = sequelize.getDialect();
  const jsonType = dialect === 'postgres' ? DataTypes.JSONB : DataTypes.JSON;
  const activityTypes = ['view', 'reaction', 'comment', 'share'];
  const typeField =
    dialect === 'sqlite' ? DataTypes.STRING : DataTypes.ENUM(...activityTypes);

  PostActivity.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      post_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      type: {
        type: typeField,
        allowNull: false,
        validate: {
          isIn: [activityTypes],
        },
      },
      metadata: {
        type: jsonType,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'PostActivity',
      tableName: 'post_activities',
      updatedAt: 'updated_at',
      createdAt: 'created_at',
    }
  );

  return PostActivity;
};
