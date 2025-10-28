'use strict';

const { v4: uuid } = require('uuid');
const dayjs = require('dayjs');
const bcrypt = require('bcrypt');

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const [[admin]] = await queryInterface.sequelize.query(
        "SELECT id FROM users WHERE email = 'admin@gigvora.test' LIMIT 1",
        { transaction }
      );

      let adminId = admin?.id;
      if (!adminId) {
        adminId = uuid();
        await queryInterface.bulkInsert(
          'users',
          [
            {
              id: adminId,
              email: 'admin@gigvora.test',
              password_hash: await bcrypt.hash('Admin123!', 10),
              role: 'admin',
              active_role: 'admin',
              is_verified: true,
              status: 'active',
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
          { transaction }
        );
      }

      const [[candidate]] = await queryInterface.sequelize.query(
        "SELECT id FROM users WHERE email = 'candidate@gigvora.test' LIMIT 1",
        { transaction }
      );
      let candidateId = candidate?.id;
      if (!candidateId) {
        candidateId = uuid();
        await queryInterface.bulkInsert(
          'users',
          [
            {
              id: candidateId,
              email: 'candidate@gigvora.test',
              password_hash: await bcrypt.hash('Candidate123!', 10),
              role: 'freelancer',
              active_role: 'freelancer',
              is_verified: true,
              status: 'active',
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
          { transaction }
        );
      }

      const jobId = uuid();
      const now = new Date();
      const publishedAt = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 3);
      const closesAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30);

      await queryInterface.bulkInsert(
        'jobs',
        [
          {
            id: jobId,
            posted_by: adminId,
            company_id: adminId,
            title: 'Senior Full Stack Engineer',
            slug: 'senior-full-stack-engineer',
            description:
              'Lead development of high-impact web applications, collaborate with cross-functional teams, and mentor junior engineers.',
            location: 'Remote - North America',
            job_type: 'full_time',
            salary_min: 130000,
            salary_max: 160000,
            salary_currency: 'USD',
            status: 'open',
            published_at: publishedAt,
            closes_at: closesAt,
            views_count: 42,
            applications_count: 3,
            hires_count: 1,
            metadata: JSON.stringify({ department: 'Engineering', seniority: 'Senior' }),
            created_at: publishedAt,
            updated_at: now,
          },
        ],
        { transaction }
      );

      const stageApplied = uuid();
      const stageScreen = uuid();
      const stageInterview = uuid();
      const stageOffer = uuid();
      const stageHire = uuid();

      await queryInterface.bulkInsert(
        'job_stages',
        [
          {
            id: stageApplied,
            job_id: jobId,
            name: 'Application Review',
            slug: 'application-review',
            order_index: 1,
            is_default: true,
            created_at: publishedAt,
            updated_at: now,
          },
          {
            id: stageScreen,
            job_id: jobId,
            name: 'Initial Screen',
            slug: 'initial-screen',
            order_index: 2,
            is_default: false,
            created_at: publishedAt,
            updated_at: now,
          },
          {
            id: stageInterview,
            job_id: jobId,
            name: 'Panel Interview',
            slug: 'panel-interview',
            order_index: 3,
            is_default: false,
            created_at: publishedAt,
            updated_at: now,
          },
          {
            id: stageOffer,
            job_id: jobId,
            name: 'Offer',
            slug: 'offer',
            order_index: 4,
            is_default: false,
            created_at: publishedAt,
            updated_at: now,
          },
          {
            id: stageHire,
            job_id: jobId,
            name: 'Hired',
            slug: 'hired',
            order_index: 5,
            is_default: false,
            created_at: publishedAt,
            updated_at: now,
          },
        ],
        { transaction }
      );

      await queryInterface.bulkInsert(
        'job_tags',
        [
          { id: uuid(), job_id: jobId, tag: 'nodejs', created_at: now, updated_at: now },
          { id: uuid(), job_id: jobId, tag: 'react', created_at: now, updated_at: now },
          { id: uuid(), job_id: jobId, tag: 'aws', created_at: now, updated_at: now },
        ],
        { transaction }
      );

      const applicationId = uuid();
      const applicationCreated = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2);
      await queryInterface.bulkInsert(
        'job_applications',
        [
          {
            id: applicationId,
            job_id: jobId,
            stage_id: stageInterview,
            candidate_id: candidateId,
            resume_url: 'https://cdn.gigvora.test/resumes/candidate.pdf',
            parsed_fields: JSON.stringify({
              name: 'Casey Candidate',
              skills: ['Node.js', 'React', 'AWS'],
              experience_years: 7,
            }),
            status: 'interviewing',
            notes: 'Strong engineering background with leadership experience.',
            rating: 4,
            tags_snapshot: JSON.stringify(['top_talent', 'referral']),
            email: 'candidate@gigvora.test',
            phone: '+1-555-100-2000',
            created_at: applicationCreated,
            updated_at: now,
          },
        ],
        { transaction }
      );

      await queryInterface.bulkInsert(
        'application_tags',
        [
          { id: uuid(), application_id: applicationId, tag: 'referral', created_at: now, updated_at: now },
          { id: uuid(), application_id: applicationId, tag: 'priority', created_at: now, updated_at: now },
        ],
        { transaction }
      );

      await queryInterface.bulkInsert(
        'scorecards',
        [
          {
            id: uuid(),
            application_id: applicationId,
            reviewer_id: adminId,
            overall_rating: 5,
            recommendation: 'hire',
            competencies: JSON.stringify({
              coding: 5,
              architecture: 4,
              communication: 5,
            }),
            summary: 'Excellent problem-solving skills and cultural fit.',
            submitted_at: now,
            created_at: now,
            updated_at: now,
          },
        ],
        { transaction }
      );

      const interviewId = uuid();
      const scheduledAt = new Date(now.getTime() + 1000 * 60 * 60 * 24);
      await queryInterface.bulkInsert(
        'interviews',
        [
          {
            id: interviewId,
            job_id: jobId,
            application_id: applicationId,
            scheduled_at: scheduledAt,
            duration_minutes: 60,
            meeting_url: 'https://meet.gigvora.test/interview/123',
            location: 'Virtual',
            status: 'scheduled',
            panel: JSON.stringify([
              { id: adminId, name: 'Alex Admin', role: 'Hiring Manager' },
              { id: candidateId, name: 'Casey Candidate', role: 'Guest' },
            ]),
            notes: 'Focus on system design and leadership scenarios.',
            created_at: now,
            updated_at: now,
          },
        ],
        { transaction }
      );

      await queryInterface.bulkInsert(
        'interview_feedback',
        [
          {
            id: uuid(),
            interview_id: interviewId,
            reviewer_id: adminId,
            rating: 5,
            highlights: 'Strong technical leadership and communication.',
            concerns: 'Needs more exposure to fintech compliance.',
            recommendation: 'hire',
            submitted_at: now,
            created_at: now,
            updated_at: now,
          },
        ],
        { transaction }
      );

      const metricDate = dayjs().startOf('day').toDate();
      await queryInterface.bulkInsert(
        'job_metrics',
        [
          {
            id: uuid(),
            job_id: jobId,
            metric_date: metricDate,
            views_count: 5,
            applications_count: 1,
            created_at: now,
            updated_at: now,
          },
          {
            id: uuid(),
            job_id: jobId,
            metric_date: dayjs(metricDate).subtract(1, 'day').toDate(),
            views_count: 12,
            applications_count: 1,
            created_at: now,
            updated_at: now,
          },
        ],
        { transaction }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('interview_feedback', null, {});
    await queryInterface.bulkDelete('interviews', null, {});
    await queryInterface.bulkDelete('scorecards', null, {});
    await queryInterface.bulkDelete('application_tags', null, {});
    await queryInterface.bulkDelete('job_applications', null, {});
    await queryInterface.bulkDelete('job_metrics', null, {});
    await queryInterface.bulkDelete('job_stages', null, {});
    await queryInterface.bulkDelete('job_tags', null, {});
    await queryInterface.bulkDelete('jobs', null, {});
    await queryInterface.bulkDelete('users', { email: 'candidate@gigvora.test' }, {});
  },
};
