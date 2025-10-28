'use strict';

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { v4: uuid } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const password = await bcrypt.hash('Admin123!', 10);
    const adminId = uuid();
    const adminEmail = 'admin@gigvora.test';
    const [existing] = await queryInterface.sequelize.query('SELECT id FROM users WHERE email = :email', {
      replacements: { email: adminEmail },
    });

    if (!existing.length) {
      const now = new Date();
      await queryInterface.bulkInsert('users', [
        {
          id: adminId,
          email: adminEmail,
          password_hash: password,
          role: 'admin',
          active_role: 'admin',
          is_verified: true,
          status: 'active',
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('profiles', [
        {
          id: uuid(),
          user_id: adminId,
          display_name: 'Administrator',
          headline: 'Platform Administrator',
          location: 'Remote',
          created_at: now,
          updated_at: now,
        },
      ]);

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
        },
      ]);
    }
  },

  async down(queryInterface) {
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
  },
};
