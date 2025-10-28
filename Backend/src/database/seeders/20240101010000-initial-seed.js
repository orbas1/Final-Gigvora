'use strict';

const bcrypt = require('bcrypt');
const { v4: uuid } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const password = await bcrypt.hash('Admin123!', 10);
    const now = new Date();

    const [existingAdmin] = await queryInterface.sequelize.query('SELECT id FROM users WHERE email = :email', {
      replacements: { email: 'admin@gigvora.test' },
    });

    let adminId;
    let adminProfileId;

    if (!existingAdmin.length) {
      adminId = uuid();
      adminProfileId = uuid();
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
          id: adminProfileId,
          user_id: adminId,
          display_name: 'Administrator',
          headline: 'Platform Administrator',
          location: 'Remote',
          created_at: now,
          updated_at: now,
        },
      ]);
    } else {
      adminId = existingAdmin[0].id;
      const [adminProfiles] = await queryInterface.sequelize.query(
        'SELECT id FROM profiles WHERE user_id = :userId LIMIT 1',
        { replacements: { userId: adminId } }
      );
      adminProfileId = adminProfiles?.[0]?.id;
    }

    const [existingReviewer] = await queryInterface.sequelize.query('SELECT id FROM users WHERE email = :email', {
      replacements: { email: 'reviewer@gigvora.test' },
    });

    let reviewerId;
    if (!existingReviewer.length) {
      reviewerId = uuid();
      const reviewerProfileId = uuid();
      await queryInterface.bulkInsert('users', [
        {
          id: reviewerId,
          email: 'reviewer@gigvora.test',
          password_hash: password,
          role: 'user',
          active_role: 'user',
          is_verified: true,
          status: 'active',
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('profiles', [
        {
          id: reviewerProfileId,
          user_id: reviewerId,
          display_name: 'Demo Reviewer',
          headline: 'Experienced Client',
          location: 'Remote',
          created_at: now,
          updated_at: now,
        },
      ]);
    } else {
      reviewerId = existingReviewer[0].id;
    }

    if (adminProfileId && reviewerId) {
      const [existingReview] = await queryInterface.sequelize.query(
        `SELECT id FROM reviews WHERE reviewer_id = :reviewerId AND subject_type = 'profile' AND subject_id = :subjectId LIMIT 1`,
        { replacements: { reviewerId, subjectId: adminProfileId } }
      );

      if (!existingReview.length) {
        await queryInterface.bulkInsert('reviews', [
          {
            id: uuid(),
            subject_type: 'profile',
            subject_id: adminProfileId,
            profile_id: adminProfileId,
            reviewer_id: reviewerId,
            rating: 5,
            comment: 'Outstanding collaboration experience.',
            created_at: now,
            updated_at: now,
          },
        ]);
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DELETE FROM reviews WHERE reviewer_id IN (SELECT id FROM users WHERE email = 'reviewer@gigvora.test')`
    );
    await queryInterface.sequelize.query(
      `DELETE FROM profiles WHERE user_id IN (SELECT id FROM users WHERE email IN ('admin@gigvora.test','reviewer@gigvora.test'))`
    );
    await queryInterface.bulkDelete('users', { email: ['admin@gigvora.test', 'reviewer@gigvora.test'] }, {});
  },
};
