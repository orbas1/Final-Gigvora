'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Post extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'author' });
      this.hasMany(models.Comment, { foreignKey: 'post_id', as: 'comments' });
      this.hasMany(models.Reaction, { foreignKey: 'post_id', as: 'reactions' });
    }
  }

  Post.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      content: DataTypes.TEXT,
      attachments: DataTypes.JSONB || DataTypes.JSON,
      share_ref: DataTypes.JSONB || DataTypes.JSON,
      visibility: {
        type: DataTypes.ENUM('public', 'connections', 'private'),
        defaultValue: 'public',
      },
      analytics_snapshot: DataTypes.JSONB || DataTypes.JSON,
    },
    {
      sequelize,
      modelName: 'Post',
      tableName: 'posts',
    }
  );

  return Post;
};
