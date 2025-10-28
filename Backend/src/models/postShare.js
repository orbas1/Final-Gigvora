'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class PostShare extends Model {
    static associate(models) {
      this.belongsTo(models.Post, { foreignKey: 'post_id', as: 'post' });
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }

  const dialect = sequelize.getDialect();
  const jsonType = dialect === 'postgres' ? DataTypes.JSONB : DataTypes.JSON;

  PostShare.init(
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
        allowNull: false,
      },
      channel: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      metadata: {
        type: jsonType,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'PostShare',
      tableName: 'post_shares',
      updatedAt: 'updated_at',
      createdAt: 'created_at',
    }
  );

  return PostShare;
};
