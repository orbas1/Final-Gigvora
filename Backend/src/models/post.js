'use strict';

const { Model, DataTypes } = require('sequelize');
const { jsonColumn, enumColumn } = require('./helpers/columnTypes');

module.exports = (sequelize) => {
  class Post extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'author' });
      this.hasMany(models.Comment, { foreignKey: 'post_id', as: 'comments' });
      this.hasMany(models.Reaction, { foreignKey: 'post_id', as: 'reactions' });
      this.belongsTo(models.Group, { foreignKey: 'group_id', as: 'group' });
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
      attachments: jsonColumn(sequelize, DataTypes, { allowNull: true }),
      share_ref: jsonColumn(sequelize, DataTypes, { allowNull: true }),
      visibility: enumColumn(sequelize, DataTypes, ['public', 'connections', 'private'], {
        defaultValue: 'public',
      }),
      analytics_snapshot: jsonColumn(sequelize, DataTypes, { allowNull: true }),
      group_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Post',
      tableName: 'posts',
    }
  );

  return Post;
};
