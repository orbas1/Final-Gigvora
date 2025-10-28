'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Comment extends Model {
    static associate(models) {
      this.belongsTo(models.Post, { foreignKey: 'post_id', as: 'post' });
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'author' });
    }
  }

  Comment.init(
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
      content: DataTypes.TEXT,
      parent_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Comment',
      tableName: 'comments',
    }
  );

  return Comment;
};
