'use strict';

const bcrypt = require('bcrypt');

module.exports = {
  async up(queryInterface) {
    const password = await bcrypt.hash('Admin123!', 10);
    const adminId = require('uuid').v4();
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
          id: require('uuid').v4(),
          user_id: adminId,
          display_name: 'Administrator',
          headline: 'Platform Administrator',
          location: 'Remote',
          created_at: new Date(),
          updated_at: new Date(),
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
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('networking_lobbies', null, {});
    await queryInterface.bulkDelete('profiles', null, {});
    await queryInterface.bulkDelete('users', { email: 'admin@gigvora.test' }, {});
  },
};
