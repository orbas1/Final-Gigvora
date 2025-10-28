'use strict';

const bcrypt = require('bcrypt');

module.exports = {
  async up(queryInterface) {
    const password = await bcrypt.hash('Admin123!', 10);
    const adminId = require('uuid').v4();
    const [existing] = await queryInterface.sequelize.query('SELECT id FROM users WHERE email = :email', {
      replacements: { email: 'admin@gigvora.test' },
    });

    const now = new Date();
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
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('profiles', [
        {
          id: require('uuid').v4(),
          user_id: adminId,
          display_name: 'Administrator',
          headline: 'Platform Administrator',
          location: 'Remote',
          created_at: now,
          updated_at: now,
        },
      ]);
    }

    const [existingDisputes] = await queryInterface.sequelize.query(
      'SELECT id FROM disputes WHERE entity_ref = :ref LIMIT 1',
      { replacements: { ref: 'order-1001' } }
    );

    if (!existingDisputes.length) {
      const disputeId = require('uuid').v4();
      const dialect = queryInterface.sequelize.getDialect();
      await queryInterface.bulkInsert('disputes', [
        {
          id: disputeId,
          entity_type: 'order',
          entity_ref: 'order-1001',
          status: 'open',
          reason: 'non_delivery',
          details: 'Client reports that deliverables were not received by the expected deadline.',
          created_by: adminId,
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('dispute_messages', [
        {
          id: require('uuid').v4(),
          dispute_id: disputeId,
          user_id: adminId,
          body: 'Dispute initiated to review non-delivery claim.',
          visibility: 'internal',
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('dispute_evidence', [
        {
          id: require('uuid').v4(),
          dispute_id: disputeId,
          user_id: adminId,
          kind: 'note',
          title: 'Initial intake summary',
          description: 'Admin captured summary of the conversation with both parties.',
          metadata:
            dialect === 'sqlite' ? JSON.stringify({ source: 'support_call' }) : { source: 'support_call' },
          created_at: now,
          updated_at: now,
        },
      ]);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('profiles', null, {});
    await queryInterface.bulkDelete('users', { email: 'admin@gigvora.test' }, {});
    await queryInterface.bulkDelete('dispute_messages', { visibility: 'internal' }, {});
    await queryInterface.bulkDelete('dispute_evidence', { kind: 'note' }, {});
    await queryInterface.bulkDelete('disputes', { entity_ref: 'order-1001' }, {});
  },
};
