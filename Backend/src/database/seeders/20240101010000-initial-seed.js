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
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('profiles', null, {});
    await queryInterface.bulkDelete('users', { email: 'admin@gigvora.test' }, {});
  },
};
