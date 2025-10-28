'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, STRING, TEXT, DATE, INTEGER, JSON, JSONB, BOOLEAN } = Sequelize;
    const dialect = queryInterface.sequelize.getDialect();
    const jsonType = dialect === 'postgres' ? JSONB : JSON;
    const enumType = (values) => (dialect === 'sqlite' ? STRING : Sequelize.ENUM(...values));
    const uuidType = dialect === 'sqlite' ? STRING : UUID;
    const uuidDefault = Sequelize.UUIDV4;

    const addColumnSafe = async (table, column, definition) => {
      const tableDefinition = await queryInterface.describeTable(table);
      if (!tableDefinition[column]) {
        await queryInterface.addColumn(table, column, definition);
      }
    };

    await addColumnSafe('posts', 'org_id', { type: uuidType, allowNull: true });
    await addColumnSafe('posts', 'comment_count', { type: INTEGER, allowNull: false, defaultValue: 0 });
    await addColumnSafe('posts', 'reaction_count', { type: INTEGER, allowNull: false, defaultValue: 0 });
    await addColumnSafe('posts', 'share_count', { type: INTEGER, allowNull: false, defaultValue: 0 });
    await addColumnSafe('posts', 'view_count', { type: INTEGER, allowNull: false, defaultValue: 0 });
    await addColumnSafe('posts', 'unique_view_count', { type: INTEGER, allowNull: false, defaultValue: 0 });
    await addColumnSafe('posts', 'last_activity_at', { type: DATE, allowNull: true });

    await queryInterface.addIndex('posts', ['org_id'], { name: 'posts_org_id_idx' });
    await queryInterface.addIndex('posts', ['created_at', 'id'], { name: 'posts_created_at_id_idx' });
    await queryInterface.addIndex('posts', ['last_activity_at'], { name: 'posts_last_activity_idx' });

    const commentTable = await queryInterface.describeTable('comments');
    if (!commentTable.parent_id) {
      await queryInterface.addColumn('comments', 'parent_id', { type: uuidType, allowNull: true });
    }

    await queryInterface.addIndex('comments', ['post_id', 'created_at'], { name: 'comments_post_created_idx' });
    await queryInterface.addIndex('comments', ['parent_id'], { name: 'comments_parent_idx' });

    await queryInterface.addIndex('reactions', ['post_id', 'type'], { name: 'reactions_post_type_idx' });
    await queryInterface.addIndex('reactions', ['user_id'], { name: 'reactions_user_idx' });
    await queryInterface.addConstraint('reactions', {
      type: 'unique',
      fields: ['post_id', 'user_id', 'deleted_at'],
      name: 'reactions_post_user_unique',
    });

    await queryInterface.createTable('post_shares', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      post_id: { type: uuidType, allowNull: false },
      user_id: { type: uuidType, allowNull: false },
      channel: { type: STRING },
      message: { type: TEXT },
      metadata: { type: jsonType },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('post_shares', {
      type: 'foreign key',
      fields: ['post_id'],
      name: 'post_shares_post_id_fkey',
      references: { table: 'posts', field: 'id' },
      onDelete: 'cascade',
    });
    await queryInterface.addConstraint('post_shares', {
      type: 'foreign key',
      fields: ['user_id'],
      name: 'post_shares_user_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });
    await queryInterface.addIndex('post_shares', ['post_id', 'created_at'], { name: 'post_shares_post_created_idx' });

    await queryInterface.createTable('post_activities', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      post_id: { type: uuidType, allowNull: false },
      user_id: { type: uuidType, allowNull: true },
      type: { type: enumType(['view', 'reaction', 'comment', 'share']), allowNull: false },
      metadata: { type: jsonType },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('post_activities', {
      type: 'foreign key',
      fields: ['post_id'],
      name: 'post_activities_post_id_fkey',
      references: { table: 'posts', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('post_activities', {
      type: 'foreign key',
      fields: ['user_id'],
      name: 'post_activities_user_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'set null',
    });

    await queryInterface.addIndex('post_activities', ['post_id', 'type', 'created_at'], {
      name: 'post_activities_post_type_created_idx',
    });
    await queryInterface.addIndex('post_activities', ['post_id', 'user_id', 'type'], {
      name: 'post_activities_unique_actor_idx',
    });

    await queryInterface.createTable('feed_metrics', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      feed: { type: STRING, allowNull: false },
      user_id: { type: uuidType, allowNull: true },
      latency_ms: { type: INTEGER, allowNull: false },
      error: { type: BOOLEAN, allowNull: false, defaultValue: false },
      status_code: { type: INTEGER },
      error_code: { type: STRING },
      metadata: { type: jsonType },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('feed_metrics', ['feed', 'created_at'], { name: 'feed_metrics_feed_created_idx' });
  },

  async down(queryInterface) {
    const removeIndexSafe = async (table, name) => {
      try {
        await queryInterface.removeIndex(table, name);
      } catch (error) {
        // ignore
      }
    };

    await queryInterface.dropTable('feed_metrics');
    await queryInterface.dropTable('post_activities');
    await queryInterface.dropTable('post_shares');

    await removeIndexSafe('posts', 'posts_org_id_idx');
    await removeIndexSafe('posts', 'posts_created_at_id_idx');
    await removeIndexSafe('posts', 'posts_last_activity_idx');
    await removeIndexSafe('comments', 'comments_post_created_idx');
    await removeIndexSafe('comments', 'comments_parent_idx');
    await removeIndexSafe('reactions', 'reactions_post_type_idx');
    await removeIndexSafe('reactions', 'reactions_user_idx');
    await removeIndexSafe('post_activities', 'post_activities_post_type_created_idx');
    await removeIndexSafe('post_activities', 'post_activities_unique_actor_idx');
    await removeIndexSafe('feed_metrics', 'feed_metrics_feed_created_idx');

    try {
      await queryInterface.removeConstraint('reactions', 'reactions_post_user_unique');
    } catch (error) {
      // ignore
    }

    const removeColumnSafe = async (table, column) => {
      try {
        await queryInterface.removeColumn(table, column);
      } catch (error) {
        // ignore
      }
    };

    await removeColumnSafe('posts', 'org_id');
    await removeColumnSafe('posts', 'comment_count');
    await removeColumnSafe('posts', 'reaction_count');
    await removeColumnSafe('posts', 'share_count');
    await removeColumnSafe('posts', 'view_count');
    await removeColumnSafe('posts', 'unique_view_count');
    await removeColumnSafe('posts', 'last_activity_at');
  },
};
