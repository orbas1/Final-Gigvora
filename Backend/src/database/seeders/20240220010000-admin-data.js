'use strict';

const bcrypt = require('bcrypt');
const dayjs = require('dayjs');
const { v4: uuid } = require('uuid');

const timestamp = () => new Date();

module.exports = {
  async up(queryInterface) {
    const ensureUser = async (email, role = 'user', extras = {}) => {
      const [existing] = await queryInterface.sequelize.query('SELECT id FROM users WHERE email = :email LIMIT 1', {
        replacements: { email },
      });

      if (existing.length) {
        return existing[0].id;
      }

      const id = uuid();
      const password = await bcrypt.hash('Password123!', 10);
      await queryInterface.bulkInsert('users', [
        {
          id,
          email,
          password_hash: password,
          role,
          active_role: role,
          is_verified: extras.is_verified ?? true,
          status: 'active',
          org_id: extras.org_id || null,
          metadata: extras.metadata || null,
          created_at: timestamp(),
          updated_at: timestamp(),
        },
      ]);

      await queryInterface.bulkInsert('profiles', [
        {
          id: uuid(),
          user_id: id,
          display_name: extras.display_name || email.split('@')[0],
          headline: extras.headline || 'Seed User',
          location: extras.location || 'Remote',
          created_at: timestamp(),
          updated_at: timestamp(),
        },
      ]);

      return id;
    };

    const admin = await ensureUser('admin@gigvora.test', 'admin', {
      display_name: 'Administrator',
      headline: 'Platform Administrator',
      is_verified: true,
    });

    const financeLead = await ensureUser('finance@gigvora.test', 'user', {
      display_name: 'Finance Lead',
      headline: 'Finance Lead',
    });

    const freelancer = await ensureUser('freelancer@gigvora.test', 'freelancer', {
      display_name: 'Top Freelancer',
    });

    const client = await ensureUser('client@gigvora.test', 'client', {
      display_name: 'Premium Client',
    });

    const orgA = uuid();
    const orgB = uuid();

    await queryInterface.bulkInsert('organizations', [
      {
        id: orgA,
        name: 'Acme Agency',
        slug: 'acme-agency',
        type: 'agency',
        owner_id: freelancer,
        status: 'active',
        verified_at: timestamp(),
        metadata: JSON.stringify({ size: 25 }),
        created_at: timestamp(),
        updated_at: timestamp(),
      },
      {
        id: orgB,
        name: 'Nova Corp',
        slug: 'nova-corp',
        type: 'company',
        owner_id: client,
        status: 'active',
        metadata: JSON.stringify({ industry: 'Design' }),
        created_at: timestamp(),
        updated_at: timestamp(),
      },
    ]);

    await queryInterface.bulkInsert('marketplace_configs', [
      {
        id: uuid(),
        categories: JSON.stringify([
          { id: 'design', label: 'Design', floor: 50 },
          { id: 'development', label: 'Development', floor: 75 },
        ]),
        floors: JSON.stringify({ design: 50, development: 75 }),
        fees: JSON.stringify({ platform: 0.1, escrow: 0.02 }),
        updated_by: admin,
        created_at: timestamp(),
        updated_at: timestamp(),
      },
    ]);

    const jobA = uuid();
    const jobB = uuid();

    await queryInterface.bulkInsert('jobs', [
      {
        id: jobA,
        org_id: orgA,
        title: 'Senior UX Designer',
        description: 'Lead design initiatives for enterprise clients.',
        status: 'open',
        is_sponsored: true,
        is_hidden: false,
        published_at: dayjs().subtract(10, 'day').toDate(),
        budget_min: 80,
        budget_max: 120,
        currency: 'USD',
        metadata: JSON.stringify({ experience: '5+ years' }),
        created_at: timestamp(),
        updated_at: timestamp(),
      },
      {
        id: jobB,
        org_id: orgB,
        title: 'Full-stack Engineer',
        description: 'Build performant web applications.',
        status: 'open',
        is_sponsored: false,
        is_hidden: false,
        published_at: dayjs().subtract(5, 'day').toDate(),
        budget_min: 90,
        budget_max: 140,
        currency: 'USD',
        metadata: JSON.stringify({ stack: ['Node.js', 'React'] }),
        created_at: timestamp(),
        updated_at: timestamp(),
      },
    ]);

    const reportId = uuid();
    await queryInterface.bulkInsert('content_reports', [
      {
        id: reportId,
        reporter_id: client,
        subject_type: 'post',
        subject_id: uuid(),
        reason: 'spam',
        details: 'Promotes unrelated services',
        status: 'reviewing',
        metadata: JSON.stringify({ severity: 'medium' }),
        created_at: timestamp(),
        updated_at: timestamp(),
      },
    ]);

    const chargeTx = uuid();
    const payoutTx = uuid();
    const refundTx = uuid();

    await queryInterface.bulkInsert('payment_transactions', [
      {
        id: chargeTx,
        type: 'charge',
        status: 'completed',
        amount: 1500.0,
        currency: 'USD',
        user_id: client,
        org_id: orgB,
        description: 'Milestone payment',
        metadata: JSON.stringify({ job_id: jobB }),
        related_entity: jobB,
        occurred_at: dayjs().subtract(7, 'day').toDate(),
        created_at: timestamp(),
        updated_at: timestamp(),
      },
      {
        id: payoutTx,
        type: 'payout',
        status: 'pending',
        amount: 1200.0,
        currency: 'USD',
        user_id: freelancer,
        org_id: orgA,
        description: 'Payout request for completed work',
        metadata: JSON.stringify({ job_id: jobA }),
        related_entity: jobA,
        occurred_at: dayjs().subtract(3, 'day').toDate(),
        created_at: timestamp(),
        updated_at: timestamp(),
      },
      {
        id: refundTx,
        type: 'refund',
        status: 'pending',
        amount: 200.0,
        currency: 'USD',
        user_id: client,
        org_id: orgB,
        description: 'Refund request for milestone overcharge',
        metadata: JSON.stringify({ job_id: jobB }),
        related_entity: jobB,
        occurred_at: dayjs().subtract(2, 'day').toDate(),
        created_at: timestamp(),
        updated_at: timestamp(),
      },
    ]);

    await queryInterface.bulkInsert('payout_requests', [
      {
        id: uuid(),
        transaction_id: payoutTx,
        recipient_id: freelancer,
        status: 'pending',
        notes: 'Awaiting finance approval',
        created_at: timestamp(),
        updated_at: timestamp(),
      },
    ]);

    const refundRequestId = uuid();
    await queryInterface.bulkInsert('refund_requests', [
      {
        id: refundRequestId,
        transaction_id: refundTx,
        requester_id: client,
        status: 'pending',
        reason: 'Scope reduced',
        created_at: timestamp(),
        updated_at: timestamp(),
      },
    ]);

    await queryInterface.bulkInsert('disputes', [
      {
        id: uuid(),
        reference_type: 'order',
        reference_id: jobB,
        claimant_id: client,
        respondent_id: freelancer,
        status: 'investigating',
        metadata: JSON.stringify({ amount: 500 }),
        created_at: timestamp(),
        updated_at: timestamp(),
      },
    ]);

    await queryInterface.bulkInsert('moderation_strikes', [
      {
        id: uuid(),
        user_id: freelancer,
        reason: 'Late delivery warning',
        severity: 'minor',
        status: 'active',
        issued_by: admin,
        expires_at: dayjs().add(30, 'day').toDate(),
        metadata: JSON.stringify({ job_id: jobA }),
        created_at: timestamp(),
        updated_at: timestamp(),
      },
    ]);

    await queryInterface.bulkInsert('platform_settings', [
      {
        id: uuid(),
        email_templates: JSON.stringify({
          welcome: { subject: 'Welcome to Gigvora', enabled: true },
          payoutApproved: { subject: 'Your payout is approved', enabled: true },
        }),
        roles: JSON.stringify({
          admin: ['manage:all'],
          support: ['view:tickets', 'update:tickets'],
        }),
        integrations: JSON.stringify({
          slack: { enabled: true, channel: '#ops' },
          sendgrid: { enabled: true },
        }),
        updated_by: admin,
        created_at: timestamp(),
        updated_at: timestamp(),
      },
    ]);

    await queryInterface.bulkInsert('audit_logs', [
      {
        id: uuid(),
        actor_id: admin,
        actor_type: 'user',
        entity_type: 'job',
        entity_id: jobA,
        action: 'job.sponsor',
        metadata: JSON.stringify({ sponsored: true }),
        created_at: dayjs().subtract(1, 'day').toDate(),
      },
      {
        id: uuid(),
        actor_id: financeLead,
        actor_type: 'user',
        entity_type: 'payout',
        entity_id: payoutTx,
        action: 'payout.review',
        metadata: JSON.stringify({ status: 'pending' }),
        created_at: dayjs().subtract(2, 'day').toDate(),
      },
    ]);

    await queryInterface.bulkInsert('search_queries', [
      {
        id: uuid(),
        query: 'design systems',
        user_id: client,
        results_count: 12,
        zero_result: false,
        searched_at: dayjs().subtract(3, 'day').toDate(),
        created_at: timestamp(),
        deleted_at: null,
      },
      {
        id: uuid(),
        query: 'vr specialist',
        user_id: client,
        results_count: 0,
        zero_result: true,
        searched_at: dayjs().subtract(1, 'day').toDate(),
        created_at: timestamp(),
        deleted_at: null,
      },
    ]);

    const metrics = [
      { metric: 'dau', dimension: null, daysAgo: 1, value: 320 },
      { metric: 'mau', dimension: null, daysAgo: 0, value: 2100 },
      { metric: 'gmv', dimension: 'platform', daysAgo: 0, value: 45200 },
      { metric: 'take_rate', dimension: 'platform', daysAgo: 0, value: 0.13 },
      { metric: 'message_volume', dimension: null, daysAgo: 0, value: 980 },
      { metric: 'cohort_retention', dimension: '2024-W05', daysAgo: 0, value: 0.56 },
      { metric: 'cohort_retention', dimension: '2024-W06', daysAgo: 0, value: 0.61 },
    ];

    await queryInterface.bulkInsert(
      'platform_metrics',
      metrics.map((metric) => ({
        id: uuid(),
        metric: metric.metric,
        value: metric.value,
        recorded_for: dayjs().subtract(metric.daysAgo, 'day').toDate(),
        dimension: metric.dimension,
        metadata: null,
        created_at: timestamp(),
      }))
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('platform_metrics', null, {});
    await queryInterface.bulkDelete('search_queries', null, {});
    await queryInterface.bulkDelete('audit_logs', null, {});
    await queryInterface.bulkDelete('platform_settings', null, {});
    await queryInterface.bulkDelete('moderation_strikes', null, {});
    await queryInterface.bulkDelete('disputes', null, {});
    await queryInterface.bulkDelete('refund_requests', null, {});
    await queryInterface.bulkDelete('payout_requests', null, {});
    await queryInterface.bulkDelete('payment_transactions', null, {});
    await queryInterface.bulkDelete('content_reports', null, {});
    await queryInterface.bulkDelete('jobs', null, {});
    await queryInterface.bulkDelete('marketplace_configs', null, {});
    await queryInterface.bulkDelete('organizations', null, {});
  },
};
