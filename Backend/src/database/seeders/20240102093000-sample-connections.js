'use strict';

const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const now = () => new Date();

module.exports = {
  async up(queryInterface) {
    const passwordHash = await bcrypt.hash('Password123!', 10);

    const ensureUser = async (email, profile) => {
      const [existing] = await queryInterface.sequelize.query(
        'SELECT id FROM users WHERE email = :email LIMIT 1',
        { replacements: { email } }
      );

      if (existing.length) {
        return existing[0].id;
      }

      const userId = uuidv4();
      const timestamp = now();
      await queryInterface.bulkInsert('users', [
        {
          id: userId,
          email,
          password_hash: passwordHash,
          role: 'user',
          active_role: 'user',
          is_verified: true,
          status: 'active',
          created_at: timestamp,
          updated_at: timestamp,
        },
      ]);

      await queryInterface.bulkInsert('profiles', [
        {
          id: uuidv4(),
          user_id: userId,
          display_name: profile.display_name,
          headline: profile.headline,
          location: profile.location,
          created_at: timestamp,
          updated_at: timestamp,
        },
      ]);

      return userId;
    };

    const ensureConnection = async (requesterId, addresseeId, attrs) => {
      const [existing] = await queryInterface.sequelize.query(
        `SELECT id FROM connections WHERE requester_id = :requesterId AND addressee_id = :addresseeId AND deleted_at IS NULL LIMIT 1`,
        {
          replacements: { requesterId, addresseeId },
        }
      );

      if (existing.length) {
        return existing[0].id;
      }

      const timestamp = now();
      await queryInterface.bulkInsert('connections', [
        {
          id: uuidv4(),
          requester_id: requesterId,
          addressee_id: addresseeId,
          status: attrs.status,
          note: attrs.note || null,
          responded_at: attrs.responded_at || null,
          created_at: timestamp,
          updated_at: timestamp,
        },
      ]);
      return true;
    };

    const aliceId = await ensureUser('alice@gigvora.test', {
      display_name: 'Alice Example',
      headline: 'Product Designer',
      location: 'Berlin, Germany',
    });
    const bobId = await ensureUser('bob@gigvora.test', {
      display_name: 'Bob Example',
      headline: 'Full-stack Engineer',
      location: 'Lisbon, Portugal',
    });
    const carolId = await ensureUser('carol@gigvora.test', {
      display_name: 'Carol Example',
      headline: 'Growth Marketer',
      location: 'Austin, USA',
    });

    await ensureConnection(aliceId, bobId, {
      status: 'accepted',
      note: 'Would love to collaborate on product design + engineering projects.',
      responded_at: now(),
    });

    await ensureConnection(bobId, carolId, {
      status: 'pending',
      note: 'Hi Carol, let\'s connect to discuss marketing automation.',
    });

    await ensureConnection(carolId, aliceId, {
      status: 'rejected',
      note: 'Thanks Alice! Maybe another time.',
      responded_at: now(),
    });
  },

  async down(queryInterface) {
    const emails = ['alice@gigvora.test', 'bob@gigvora.test', 'carol@gigvora.test'];
    const [users] = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE email IN (${emails.map((email, idx) => `:email${idx}`).join(',')})`,
      {
        replacements: Object.fromEntries(emails.map((email, idx) => [`email${idx}`, email])),
      }
    );

    if (!users.length) {
      return;
    }

    const { Op } = queryInterface.sequelize.Sequelize;
    const ids = users.map((user) => user.id);

    await queryInterface.bulkDelete(
      'connections',
      {
        [Op.or]: [{ requester_id: { [Op.in]: ids } }, { addressee_id: { [Op.in]: ids } }],
      },
      {}
    );
    await queryInterface.bulkDelete('profiles', { user_id: { [Op.in]: ids } }, {});
    await queryInterface.bulkDelete('users', { id: { [Op.in]: ids } }, {});
  },
};
