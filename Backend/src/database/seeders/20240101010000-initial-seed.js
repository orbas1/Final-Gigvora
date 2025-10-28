'use strict';

const bcrypt = require('bcrypt');
const { v4: uuid } = require('uuid');

const ADMIN_EMAIL = 'admin@gigvora.test';
const GROUP_SLUG = 'core-community';
const TAG_NAME = 'technology';
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { v4: uuid } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const password = await bcrypt.hash('Admin123!', 10);
    const now = new Date();

    const [[existingUser] = []] = await queryInterface.sequelize.query(
      'SELECT id FROM users WHERE email = :email LIMIT 1',
      { replacements: { email: ADMIN_EMAIL } }
    );

    const adminId = existingUser?.id || uuid();

    if (!existingUser) {
      await queryInterface.bulkInsert('users', [
        {
          id: adminId,
          email: ADMIN_EMAIL,
    const adminId = uuidv4();
    const adminId = uuid();
    const adminEmail = 'admin@gigvora.test';
    const [existing] = await queryInterface.sequelize.query('SELECT id FROM users WHERE email = :email', {
      replacements: { email: adminEmail },
    });

    if (!existing.length) {
      const now = new Date();
      const agencyOrgId = uuid();
      const companyOrgId = uuid();
      await queryInterface.bulkInsert('users', [
        {
          id: adminId,
          email: adminEmail,
          password_hash: password,
          role: 'admin',
          active_role: 'admin',
          org_id: agencyOrgId,
          is_verified: true,
          status: 'active',
          created_at: now,
          updated_at: now,
        },
      ]);
    }

    const [[existingProfile] = []] = await queryInterface.sequelize.query(
      'SELECT id FROM profiles WHERE user_id = :userId LIMIT 1',
      { replacements: { userId: adminId } }
    );

    if (!existingProfile) {
      await queryInterface.bulkInsert('profiles', [
        {
          id: uuid(),
      const profileId = uuid();
      await queryInterface.bulkInsert('profiles', [
        {
          id: uuidv4(),
          id: uuid(),
          id: profileId,
          user_id: adminId,
          display_name: 'Administrator',
          headline: 'Platform Administrator',
          location: 'Remote',
          created_at: now,
          updated_at: now,
        },
      ]);
    }

    const [[existingTag] = []] = await queryInterface.sequelize.query(
      'SELECT id FROM tags WHERE name = :name LIMIT 1',
      { replacements: { name: TAG_NAME } }
    );

    const tagId = existingTag?.id || uuid();

    if (!existingTag) {
      await queryInterface.bulkInsert('tags', [
        {
          id: tagId,
          name: TAG_NAME,
          description: 'Technology and innovation',

      const eventId = uuid();
      const startAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);

      await queryInterface.bulkInsert('calendar_events', [
        {
          id: eventId,
          owner_id: adminId,
          title: 'Admin onboarding sync',
          description: 'Overview of the Gigvora roadmap and initial operational checklist.',
          location: 'Virtual conference room',
          start_at: startAt,
          end_at: endAt,
          all_day: false,
          visibility: 'private',
          scope: 'user',
          status: 'confirmed',
          source: 'seed',
          metadata: JSON.stringify({ agenda: ['Platform tour', 'Security review', 'Launch checklist'] }),
      await queryInterface.bulkInsert('freelancer_profiles', [
        {
          id: uuid(),
          profile_id: profileId,
          headline: 'Platform Administration Specialist',
          availability_status: 'limited',
          specialties: JSON.stringify(['operations', 'compliance']),
          languages: JSON.stringify(['English']),
          rate_card: JSON.stringify({ hourly: 0, currency: 'USD' }),
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('agency_profiles', [
        {
          id: uuid(),
          org_id: agencyOrgId,
          owner_user_id: adminId,
          name: 'Gigvora Platform Agency',
          overview:
            'Internal agency overseeing marketplace quality, compliance, and strategic engagements for top clients.',
          website: 'https://gigvora.test/agency',
          timezone: 'UTC',
          social_links: JSON.stringify({ linkedin: 'https://linkedin.com/company/gigvora' }),
          rate_card: JSON.stringify({
            advisory: { currency: 'USD', hourly: 0 },
            audit: { currency: 'USD', project: 0 },
          }),
          metrics_snapshot: JSON.stringify({ managedTalent: 125, activeEngagements: 12 }),
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('calendar_event_participants', [
        {
          id: uuid(),
          event_id: eventId,
          user_id: adminId,
          email: adminEmail,
          name: 'Administrator',
          role: 'organizer',
          status: 'accepted',
          responded_at: now,
          metadata: JSON.stringify({ host: true }),
      await queryInterface.bulkInsert('company_profiles', [
        {
          id: uuid(),
          org_id: companyOrgId,
          owner_user_id: adminId,
          legal_name: 'Gigvora Holdings Inc.',
          brand_name: 'Gigvora',
          overview:
            'Global marketplace helping independent talent and teams collaborate with fast-growing companies.',
          website: 'https://gigvora.test',
          industry: 'Technology',
          team_size: 180,
          headquarters: 'Remote-first',
          hiring_needs: JSON.stringify({ roles: ['Full-stack Engineer', 'Customer Success Lead'] }),
          benefits: JSON.stringify({ remote: true, stipends: ['coworking', 'health'] }),
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('profile_experiences', [
        {
          id: uuid(),
          profile_id: profileId,
          title: 'Head of Platform Operations',
          company: 'Gigvora',
          start_date: new Date(now.getFullYear() - 2, 0, 1),
          is_current: true,
          description: 'Oversees marketplace health, compliance, and service quality.',
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('profile_education', [
        {
          id: uuid(),
          profile_id: profileId,
          school: 'University of Platforms',
          degree: 'MBA',
          field: 'Marketplace Strategy',
          start_date: new Date(now.getFullYear() - 6, 8, 1),
          end_date: new Date(now.getFullYear() - 4, 5, 1),
          created_at: now,
          updated_at: now,
        },
      ]);

      const opsTagId = uuid();
      const leadershipTagId = uuid();
      await queryInterface.bulkInsert('tags', [
        {
          id: opsTagId,
          name: 'operations',
          description: 'Operational excellence and process design',
          created_at: now,
          updated_at: now,
        },
        {
          id: leadershipTagId,
          name: 'leadership',
          description: 'Executive leadership and management',
          created_at: now,
          updated_at: now,
        },
      ]);
    }

    const [[existingGroup] = []] = await queryInterface.sequelize.query(
      'SELECT id FROM groups WHERE slug = :slug LIMIT 1',
      { replacements: { slug: GROUP_SLUG } }
    );

    const groupId = existingGroup?.id || uuid();

    if (!existingGroup) {
      await queryInterface.bulkInsert('groups', [
        {
          id: groupId,
          name: 'Core Community',
          slug: GROUP_SLUG,
          description: 'A space for administrators and moderators to coordinate platform decisions.',
          visibility: 'private',
          created_by: adminId,

      await queryInterface.bulkInsert('profile_tags', [
        {
          profile_id: profileId,
          tag_id: opsTagId,
          created_at: now,
          updated_at: now,
        },
        {
          profile_id: profileId,
          tag_id: leadershipTagId,
          created_at: now,
          updated_at: now,
        },
      ]);

      const operationsSkillId = uuid();
      const complianceSkillId = uuid();
      await queryInterface.bulkInsert('skills', [
        {
          id: operationsSkillId,
          name: 'Platform Operations',
          description: 'Scaling and monitoring platform activity.',
          created_at: now,
          updated_at: now,
        },
        {
          id: complianceSkillId,
          name: 'Regulatory Compliance',
          description: 'Ensuring compliance with marketplace regulations.',
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('calendar_ics_tokens', [
        {
          id: uuid(),
          user_id: adminId,
          token: crypto.randomBytes(24).toString('hex'),
          description: 'Primary admin calendar feed',
      await queryInterface.bulkInsert('profile_skills', [
        {
          profile_id: profileId,
          skill_id: operationsSkillId,
          proficiency: 'expert',
          created_at: now,
          updated_at: now,
        },
        {
          profile_id: profileId,
          skill_id: complianceSkillId,
          proficiency: 'advanced',
          created_at: now,
          updated_at: now,
        },
      ]);
    }

    const [[existingMembership] = []] = await queryInterface.sequelize.query(
      'SELECT id FROM group_members WHERE group_id = :groupId AND user_id = :userId LIMIT 1',
      { replacements: { groupId, userId: adminId } }
    );

    if (!existingMembership) {
      await queryInterface.bulkInsert('group_members', [
        {
          id: uuid(),
          group_id: groupId,
          user_id: adminId,
          role: 'owner',
          joined_at: now,
          created_at: now,
          updated_at: now,
        },
      ]);
    }

    const [[existingGroupTag] = []] = await queryInterface.sequelize.query(
      'SELECT 1 FROM group_tags WHERE group_id = :groupId AND tag_id = :tagId LIMIT 1',
      { replacements: { groupId, tagId } }
    );

    if (!existingGroupTag) {
      await queryInterface.bulkInsert('group_tags', [
        {
          group_id: groupId,
          tag_id: tagId,

      await queryInterface.bulkInsert('portfolio_items', [
        {
          id: uuid(),
          profile_id: profileId,
          title: 'Incident Response Framework',
          description: 'A documented framework covering 24/7 on-call rotations and communication protocols.',
          url: 'https://gigvora.test/playbooks/incident-response',
          media: JSON.stringify({ type: 'document', storage_key: 'playbooks/incident-response.pdf' }),
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('calendar_integrations', [
        {
          id: uuid(),
          user_id: adminId,
          provider: 'internal',
          external_account_id: 'gigvora-calendar',
          settings: JSON.stringify({ sync_window: '00:00-23:59' }),
          status: 'connected',
          created_at: now,
          updated_at: now,
      await queryInterface.bulkInsert('profile_views', [
        {
          id: uuid(),
          profile_id: profileId,
          viewer_id: adminId,
          source: 'seed',
          viewed_at: now,
          created_at: now,
          updated_at: now,
        },
      ]);

      const lobbyNow = new Date();
      await queryInterface.bulkInsert('networking_lobbies', [
        {
          id: require('uuid').v4(),
          topic: 'Product Pitch Connect',
          description: 'Five-minute rapid-fire pitches between founders and investors.',
          duration_minutes: 5,
          is_paid: false,
          status: 'open',
          max_participants: 2,
          created_by: adminId,
          metadata: JSON.stringify({ track: 'startup', language: 'en' }),
          created_at: lobbyNow,
          updated_at: lobbyNow,
        },
        {
          id: require('uuid').v4(),
          topic: 'Design Speed Networking',
          description: 'Two-minute pairing rounds for product and UX designers.',
          duration_minutes: 2,
          is_paid: false,
          status: 'open',
          max_participants: 2,
          created_by: adminId,
          metadata: JSON.stringify({ track: 'design', language: 'en' }),
          created_at: lobbyNow,
          updated_at: lobbyNow,
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
    const [[group] = []] = await queryInterface.sequelize.query(
      'SELECT id FROM groups WHERE slug = :slug LIMIT 1',
      { replacements: { slug: GROUP_SLUG } }
    );

    if (group?.id) {
      await queryInterface.bulkDelete('group_tags', { group_id: group.id }, {});
      await queryInterface.bulkDelete('group_members', { group_id: group.id }, {});
      await queryInterface.bulkDelete('groups', { id: group.id }, {});
    }

    const [[admin] = []] = await queryInterface.sequelize.query(
      'SELECT id FROM users WHERE email = :email LIMIT 1',
      { replacements: { email: ADMIN_EMAIL } }
    );

    if (admin?.id) {
      await queryInterface.bulkDelete('profiles', { user_id: admin.id }, {});
      await queryInterface.bulkDelete('users', { id: admin.id }, {});
    }

    await queryInterface.bulkDelete('tags', { name: TAG_NAME }, {});
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

    const adminEmail = 'admin@gigvora.test';
    const [users] = await queryInterface.sequelize.query('SELECT id FROM users WHERE email = :email', {
      replacements: { email: adminEmail },
    });

    if (users.length) {
      const adminId = users[0].id;
      await queryInterface.bulkDelete('calendar_event_participants', { user_id: adminId }, {});
      await queryInterface.bulkDelete('calendar_events', { owner_id: adminId }, {});
      await queryInterface.bulkDelete('calendar_ics_tokens', { user_id: adminId }, {});
      await queryInterface.bulkDelete('calendar_integrations', { user_id: adminId }, {});
      await queryInterface.bulkDelete('profiles', { user_id: adminId }, {});
      await queryInterface.bulkDelete('users', { id: adminId }, {});
    }
    const [[user]] = await queryInterface.sequelize.query('SELECT id FROM users WHERE email = :email', {
      replacements: { email: 'admin@gigvora.test' },
    });

    if (user) {
      const [[profile]] = await queryInterface.sequelize.query('SELECT id FROM profiles WHERE user_id = :userId', {
        replacements: { userId: user.id },
      });

      if (profile) {
        await queryInterface.bulkDelete('profile_views', { profile_id: profile.id });
        await queryInterface.bulkDelete('portfolio_items', { profile_id: profile.id });
        await queryInterface.bulkDelete('profile_skills', { profile_id: profile.id });
        await queryInterface.bulkDelete('profile_tags', { profile_id: profile.id });
        await queryInterface.bulkDelete('profile_education', { profile_id: profile.id });
        await queryInterface.bulkDelete('profile_experiences', { profile_id: profile.id });
        await queryInterface.bulkDelete('freelancer_profiles', { profile_id: profile.id });
        await queryInterface.bulkDelete('agency_profiles', { owner_user_id: user.id });
        await queryInterface.bulkDelete('company_profiles', { owner_user_id: user.id });
        await queryInterface.bulkDelete('profiles', { id: profile.id });
      }

      await queryInterface.bulkDelete('skills', {
        name: ['Platform Operations', 'Regulatory Compliance'],
      });
      await queryInterface.bulkDelete('tags', { name: ['operations', 'leadership'] });
      await queryInterface.bulkDelete('users', { id: user.id });
    }
    await queryInterface.bulkDelete('networking_lobbies', null, {});
    await queryInterface.bulkDelete('profiles', null, {});
    await queryInterface.bulkDelete('users', { email: 'admin@gigvora.test' }, {});
  },
};
