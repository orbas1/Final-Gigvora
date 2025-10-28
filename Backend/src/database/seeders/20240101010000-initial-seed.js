'use strict';

const bcrypt = require('bcrypt');
const { v4: uuid } = require('uuid');

const ADMIN_EMAIL = 'admin@gigvora.test';
const GROUP_SLUG = 'core-community';
const TAG_NAME = 'technology';

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
          password_hash: password,
          role: 'admin',
          active_role: 'admin',
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
  },
};
