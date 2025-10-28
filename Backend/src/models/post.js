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
      this.hasMany(models.PostShare, { foreignKey: 'post_id', as: 'shares' });
      this.hasMany(models.PostActivity, { foreignKey: 'post_id', as: 'activities' });
    }
  }

  const dialect = sequelize.getDialect();
  const jsonType = dialect === 'postgres' ? DataTypes.JSONB : DataTypes.JSON;

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
      org_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      attachments: {
        type: jsonType,
        allowNull: true,
      },
      share_ref: {
        type: jsonType,
        allowNull: true,
      },
      visibility: {
        type: DataTypes.ENUM('public', 'connections', 'private'),
        defaultValue: 'public',
      }),
      analytics_snapshot: jsonColumn(sequelize, DataTypes, { allowNull: true }),
      group_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      analytics_snapshot: {
        type: jsonType,
        allowNull: true,
      },
      comment_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      reaction_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      share_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      view_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      unique_view_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      last_activity_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Post',
      tableName: 'posts',
      paranoid: true,
      defaultScope: {
        order: [['created_at', 'DESC']],
      },
      hooks: {
        beforeCreate: (instance) => {
          if (!instance.last_activity_at) {
            instance.last_activity_at = new Date();
          }
        },
      },
    }
  );

  return Post;
};
