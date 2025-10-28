'use strict';

const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const password = await bcrypt.hash('Admin123!', 10);
    const adminId = uuidv4();
    const [existing] = await queryInterface.sequelize.query('SELECT id FROM users WHERE email = :email', {
      replacements: { email: 'admin@gigvora.test' },
    });

    if (!existing.length) {
      await queryInterface.bulkInsert('users', [
        {
          id: adminId,
          email: 'admin@gigvora.test',
          password_hash: password,
          role: 'admin',
          active_role: 'admin',
          is_verified: true,
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      await queryInterface.bulkInsert('profiles', [
        {
          id: uuidv4(),
          user_id: adminId,
          display_name: 'Administrator',
          headline: 'Platform Administrator',
          location: 'Remote',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);
    }

    const [existingPosts] = await queryInterface.sequelize.query(
      'SELECT id FROM posts WHERE user_id = :userId LIMIT 1',
      { replacements: { userId: adminId } }
    );

    if (!existingPosts.length) {
      const now = new Date();
      const welcomePostId = uuidv4();
      const updatePostId = uuidv4();

      await queryInterface.bulkInsert('posts', [
        {
          id: welcomePostId,
          user_id: adminId,
          content: 'Welcome to Gigvora! This is your operations feed where major platform updates land first.',
          attachments: null,
          share_ref: null,
          visibility: 'public',
          analytics_snapshot: null,
          comment_count: 1,
          reaction_count: 1,
          share_count: 0,
          view_count: 25,
          unique_view_count: 10,
          last_activity_at: now,
          created_at: now,
          updated_at: now,
        },
        {
          id: updatePostId,
          user_id: adminId,
          content: 'Daily stand-up reminder: share your wins, blockers, and plans for the day to keep the team aligned.',
          attachments: null,
          share_ref: null,
          visibility: 'public',
          analytics_snapshot: null,
          comment_count: 0,
          reaction_count: 0,
          share_count: 0,
          view_count: 12,
          unique_view_count: 6,
          last_activity_at: now,
          created_at: now,
          updated_at: now,
        },
      ]);

      const welcomeCommentId = uuidv4();
      const welcomeReactionId = uuidv4();

      await queryInterface.bulkInsert('comments', [
        {
          id: welcomeCommentId,
          post_id: welcomePostId,
          user_id: adminId,
          content: 'First update is live – let us know what you think!',
          parent_id: null,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        },
      ]);

      await queryInterface.bulkInsert('reactions', [
        {
          id: welcomeReactionId,
          post_id: welcomePostId,
          user_id: adminId,
          type: 'like',
          created_at: now,
          updated_at: now,
          deleted_at: null,
        },
      ]);

      const activities = [
        { type: 'view' },
        { type: 'view' },
        { type: 'view' },
        { type: 'reaction', metadata: { reaction_type: 'like' } },
        { type: 'comment', metadata: { comment_id: welcomeCommentId } },
      ];

      await queryInterface.bulkInsert(
        'post_activities',
        activities.map((activity) => ({
          id: uuidv4(),
          post_id: welcomePostId,
          user_id: adminId,
          type: activity.type,
          metadata: activity.metadata ? JSON.stringify(activity.metadata) : null,
          created_at: now,
          updated_at: now,
        }))
      );

      await queryInterface.bulkInsert('feed_metrics', [
        {
          id: uuidv4(),
          feed: 'home',
          user_id: adminId,
          latency_ms: 42,
          error: false,
          status_code: 200,
          error_code: null,
          metadata: JSON.stringify({ seed: true }),
          created_at: now,
          updated_at: now,
        },
        {
          id: uuidv4(),
          feed: 'home',
          user_id: adminId,
          latency_ms: 55,
          error: false,
          status_code: 200,
          error_code: null,
          metadata: JSON.stringify({ seed: true }),
          created_at: now,
          updated_at: now,
        },
      ]);
    }
  },

  async down(queryInterface) {
    const [adminRows] = await queryInterface.sequelize.query(
      'SELECT id FROM users WHERE email = :email LIMIT 1',
      { replacements: { email: 'admin@gigvora.test' } }
    );
    const adminId = adminRows.length ? adminRows[0].id : null;

    const [postRows] = await queryInterface.sequelize.query(
      'SELECT id FROM posts WHERE content IN (:welcome, :standup)',
      {
        replacements: {
          welcome: 'Welcome to Gigvora! This is your operations feed where major platform updates land first.',
          standup: 'Daily stand-up reminder: share your wins, blockers, and plans for the day to keep the team aligned.',
        },
      }
    );
    const postIds = postRows.map((row) => row.id);

    if (postIds.length) {
      await queryInterface.bulkDelete('post_activities', { post_id: { [Op.in]: postIds } }, {});
      await queryInterface.bulkDelete('post_shares', { post_id: { [Op.in]: postIds } }, {});
      await queryInterface.bulkDelete('reactions', { post_id: { [Op.in]: postIds } }, {});
      await queryInterface.bulkDelete('comments', { post_id: { [Op.in]: postIds } }, {});
      await queryInterface.bulkDelete('posts', { id: { [Op.in]: postIds } }, {});
    }

    if (adminId) {
      await queryInterface.bulkDelete(
        'feed_metrics',
        { user_id: adminId, latency_ms: { [Op.in]: [42, 55] }, status_code: 200 },
        {}
      );
    }

    await queryInterface.bulkDelete('profiles', null, {});
    await queryInterface.bulkDelete('users', { email: 'admin@gigvora.test' }, {});
  },
};
