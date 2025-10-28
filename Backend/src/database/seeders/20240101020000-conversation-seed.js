'use strict';

const bcrypt = require('bcrypt');
const { v4: uuid } = require('uuid');
const { Op } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    const [adminRows] = await queryInterface.sequelize.query('SELECT id FROM users WHERE email = :email LIMIT 1', {
      replacements: { email: 'admin@gigvora.test' },
    });
    const adminId = adminRows.length ? adminRows[0].id : uuid();

    let memberId = uuid();
    const [existingMember] = await queryInterface.sequelize.query('SELECT id FROM users WHERE email = :email LIMIT 1', {
      replacements: { email: 'member@gigvora.test' },
    });
    if (existingMember.length) {
      memberId = existingMember[0].id;
    } else {
      const password = await bcrypt.hash('Member123!', 10);
      await queryInterface.bulkInsert('users', [
        {
          id: memberId,
          email: 'member@gigvora.test',
          password_hash: password,
          role: 'user',
          active_role: 'user',
          is_verified: true,
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);
      await queryInterface.bulkInsert('profiles', [
        {
          id: uuid(),
          user_id: memberId,
          display_name: 'Demo Member',
          headline: 'Community Member',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);
    }

    const conversationId = uuid();
    await queryInterface.bulkInsert('conversations', [
      {
        id: conversationId,
        title: 'Welcome to Gigvora',
        type: 'direct',
        created_by: adminId,
        last_message_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    await queryInterface.bulkInsert('conversation_participants', [
      {
        id: uuid(),
        conversation_id: conversationId,
        user_id: adminId,
        role: 'owner',
        joined_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuid(),
        conversation_id: conversationId,
        user_id: memberId,
        role: 'member',
        joined_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    const messageId = uuid();
    await queryInterface.bulkInsert('messages', [
      {
        id: messageId,
        conversation_id: conversationId,
        sender_id: adminId,
        text: 'Thanks for joining Gigvora! This space keeps your important updates.',
        attachments: JSON.stringify([]),
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    await queryInterface.bulkInsert('message_reads', [
      {
        id: uuid(),
        message_id: messageId,
        user_id: adminId,
        read_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface) {
    const [memberRows] = await queryInterface.sequelize.query(
      "SELECT id FROM users WHERE email = 'member@gigvora.test'"
    );
    const memberIds = memberRows.map((row) => row.id);

    const [conversationRows] = await queryInterface.sequelize.query(
      "SELECT id FROM conversations WHERE title = 'Welcome to Gigvora'"
    );
    const conversationIds = conversationRows.map((row) => row.id);

    if (conversationIds.length) {
      const [messageRows] = await queryInterface.sequelize.query(
        'SELECT id FROM messages WHERE conversation_id IN (:ids)',
        { replacements: { ids: conversationIds } }
      );
      const messageIds = messageRows.map((row) => row.id);
      if (messageIds.length) {
        await queryInterface.bulkDelete('message_reads', { message_id: { [Op.in]: messageIds } }, {});
        await queryInterface.bulkDelete('messages', { id: { [Op.in]: messageIds } }, {});
      }
      await queryInterface.bulkDelete(
        'conversation_participants',
        { conversation_id: { [Op.in]: conversationIds } },
        {}
      );
      await queryInterface.bulkDelete('conversations', { id: { [Op.in]: conversationIds } }, {});
    }

    if (memberIds.length) {
      await queryInterface.bulkDelete('message_reads', { user_id: { [Op.in]: memberIds } }, {});
      await queryInterface.bulkDelete('profiles', { user_id: { [Op.in]: memberIds } }, {});
      await queryInterface.bulkDelete('users', { id: { [Op.in]: memberIds } }, {});
    }
  },
};
