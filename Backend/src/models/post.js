'use strict';

const { Model, DataTypes } = require('sequelize');
const { jsonColumn, enumColumn } = require('./helpers/columnTypes');

const VISIBILITY_OPTIONS = ['public', 'connections', 'private'];

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
      org_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      group_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      attachments: jsonColumn(sequelize, DataTypes, {
        allowNull: true,
        defaultValue: [],
      }),
      share_ref: jsonColumn(sequelize, DataTypes, {
        allowNull: true,
        defaultValue: null,
      }),
      visibility: enumColumn(sequelize, DataTypes, VISIBILITY_OPTIONS, {
        allowNull: false,
        defaultValue: 'public',
      }),
      analytics_snapshot: jsonColumn(sequelize, DataTypes, {
        allowNull: true,
        defaultValue: {},
      }),
      comment_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      reaction_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      share_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      view_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      unique_view_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
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
