'use strict';

const { v4: uuid } = require('uuid');

const buildReview = ({ subject_type, subject_id, reviewer_id, rating, comment, scope }) => ({
  id: uuid(),
  subject_type,
  subject_id,
  reviewer_id,
  rating,
  comment,
  metadata: JSON.stringify({ seeded: true, scope }),
  created_at: new Date(),
  updated_at: new Date(),
});

module.exports = {
  async up(queryInterface) {
    const reviews = [];

    const [adminRows] = await queryInterface.sequelize.query(
      "SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1"
    );
    const adminId = adminRows[0]?.id || null;

    const [profileRows] = await queryInterface.sequelize.query(
      'SELECT id, user_id FROM profiles WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1'
    );
    const profile = profileRows[0];

    if (profile && adminId && profile.user_id !== adminId) {
      const [existingProfileReview] = await queryInterface.sequelize.query(
        "SELECT id FROM reviews WHERE subject_type = 'profile' AND subject_id = :subjectId AND reviewer_id = :reviewerId",
        { replacements: { subjectId: profile.id, reviewerId: adminId } }
      );
      if (!existingProfileReview.length) {
        reviews.push(
          buildReview({
            subject_type: 'profile',
            subject_id: profile.id,
            reviewer_id: adminId,
            rating: 5,
            comment: 'Seeded profile review for launch readiness.',
            scope: 'profile',
          })
        );
      }
    }

    const [jobRows] = await queryInterface.sequelize.query(
      'SELECT id, posted_by FROM jobs WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1'
    );
    const job = jobRows[0];

    if (job) {
      const [candidateRows] = await queryInterface.sequelize.query(
        'SELECT candidate_id FROM job_applications WHERE deleted_at IS NULL AND job_id = :jobId AND candidate_id IS NOT NULL ORDER BY created_at ASC LIMIT 1',
        { replacements: { jobId: job.id } }
      );
      const jobReviewerId = candidateRows[0]?.candidate_id || job.posted_by || adminId;
      if (jobReviewerId) {
        const [existingProjectReview] = await queryInterface.sequelize.query(
          "SELECT id FROM reviews WHERE subject_type = 'project' AND subject_id = :subjectId AND reviewer_id = :reviewerId",
          { replacements: { subjectId: job.id, reviewerId: jobReviewerId } }
        );
        if (!existingProjectReview.length) {
          reviews.push(
            buildReview({
              subject_type: 'project',
              subject_id: job.id,
              reviewer_id: jobReviewerId,
              rating: 4,
              comment: 'Seeded project delivery feedback.',
              scope: 'project',
            })
          );
        }
      }
    }

    const [orderRows] = await queryInterface.sequelize.query(
      `SELECT e.id, payer.user_id AS payer_user_id, payee.user_id AS payee_user_id
       FROM escrow_intents e
       LEFT JOIN wallets payer ON payer.id = e.payer_wallet_id
       LEFT JOIN wallets payee ON payee.id = e.payee_wallet_id
       WHERE e.deleted_at IS NULL
       ORDER BY e.created_at ASC
       LIMIT 1`
    );
    const order = orderRows[0];

    if (order) {
      const orderReviewerId = order.payer_user_id || order.payee_user_id || adminId;
      if (orderReviewerId) {
        const [existingOrderReview] = await queryInterface.sequelize.query(
          "SELECT id FROM reviews WHERE subject_type = 'order' AND subject_id = :subjectId AND reviewer_id = :reviewerId",
          { replacements: { subjectId: order.id, reviewerId: orderReviewerId } }
        );
        if (!existingOrderReview.length) {
          reviews.push(
            buildReview({
              subject_type: 'order',
              subject_id: order.id,
              reviewer_id: orderReviewerId,
              rating: 5,
              comment: 'Seeded order escrow review.',
              scope: 'order',
            })
          );
        }
      }
    }

    if (reviews.length) {
      await queryInterface.bulkInsert('reviews', reviews);
    }
  },

  async down(queryInterface, Sequelize) {
    const { Op } = Sequelize;
    await queryInterface.bulkDelete(
      'reviews',
      {
        comment: {
          [Op.in]: [
            'Seeded profile review for launch readiness.',
            'Seeded project delivery feedback.',
            'Seeded order escrow review.',
          ],
        },
      }
    );
  },
};
