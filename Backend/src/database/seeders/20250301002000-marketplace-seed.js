'use strict';

const bcrypt = require('bcrypt');
const { v4: uuid } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const dialect = queryInterface.sequelize.getDialect();
    const encodeJson = (value) => (dialect === 'sqlite' ? JSON.stringify(value) : value);
    const now = new Date();

    const ensureUser = async ({ email, role, displayName, headline }) => {
      const [[existing] = []] = await queryInterface.sequelize.query(
        'SELECT id FROM users WHERE email = :email LIMIT 1',
        { replacements: { email } }
      );

      if (existing?.id) {
        return existing.id;
      }

      const userId = uuid();
      const profileId = uuid();
      const passwordHash = await bcrypt.hash('Password123!', 10);

      await queryInterface.bulkInsert('users', [
        {
          id: userId,
          email,
          password_hash: passwordHash,
          role,
          active_role: role,
          is_verified: true,
          status: 'active',
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('profiles', [
        {
          id: profileId,
          user_id: userId,
          display_name: displayName,
          headline,
          location: 'Remote',
          created_at: now,
          updated_at: now,
        },
      ]);

      return userId;
    };

    const clientId = await ensureUser({
      email: 'client.marketplace@gigvora.test',
      role: 'client',
      displayName: 'Marketplace Client',
      headline: 'Startup Founder',
    });

    const freelancerId = await ensureUser({
      email: 'freelancer.marketplace@gigvora.test',
      role: 'freelancer',
      displayName: 'Marketplace Freelancer',
      headline: 'Full-stack Specialist',
    });

    const sellerId = await ensureUser({
      email: 'seller.marketplace@gigvora.test',
      role: 'freelancer',
      displayName: 'Marketplace Seller',
      headline: 'Design Studio',
    });

    const buyerId = await ensureUser({
      email: 'buyer.marketplace@gigvora.test',
      role: 'client',
      displayName: 'Marketplace Buyer',
      headline: 'Marketing Lead',
    });

    const [[existingProject] = []] = await queryInterface.sequelize.query(
      "SELECT id FROM projects WHERE title = 'Website Redesign Initiative' LIMIT 1"
    );

    let projectId = existingProject?.id;
    if (!projectId) {
      projectId = uuid();
      await queryInterface.bulkInsert('projects', [
        {
          id: projectId,
          owner_id: clientId,
          title: 'Website Redesign Initiative',
          slug: 'website-redesign-initiative',
          description: 'Complete redesign of marketing website with responsive templates and CMS integration.',
          status: 'open',
          project_type: 'fixed',
          budget_min: 8000,
          budget_max: 12000,
          budget_currency: 'USD',
          hourly_rate: null,
          estimated_hours: null,
          timeline: '6 weeks',
          requirements: 'Experience with Next.js, Tailwind, and headless CMS.',
          attachments: encodeJson([{ name: 'brief.pdf', url: 'https://cdn.gigvora.test/brief.pdf' }]),
          tags_count: 2,
          invites_count: 1,
          bids_count: 1,
          milestones_count: 2,
          deliverables_count: 1,
          timelogs_count: 1,
          reviews_count: 1,
          rating_average: 4.8,
          last_activity_at: now,
          metadata: encodeJson({ source: 'seed' }),
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('project_tags', [
        {
          id: uuid(),
          project_id: projectId,
          tag: 'design',
          created_at: now,
          updated_at: now,
        },
        {
          id: uuid(),
          project_id: projectId,
          tag: 'webflow',
          created_at: now,
          updated_at: now,
        },
      ]);

      const inviteId = uuid();
      await queryInterface.bulkInsert('project_invites', [
        {
          id: inviteId,
          project_id: projectId,
          inviter_id: clientId,
          invitee_id: freelancerId,
          status: 'pending',
          message: 'We would love to have you bid on this project.',
          created_at: now,
          updated_at: now,
        },
      ]);

      const bidId = uuid();
      await queryInterface.bulkInsert('project_bids', [
        {
          id: bidId,
          project_id: projectId,
          bidder_id: freelancerId,
          amount: 10500,
          currency: 'USD',
          bid_type: 'fixed',
          hourly_rate: null,
          proposed_hours: null,
          cover_letter: 'Excited to collaborate on this redesign. See attached concepts.',
          attachments: encodeJson([{ name: 'concepts.zip', url: 'https://cdn.gigvora.test/concepts.zip' }]),
          status: 'accepted',
          estimated_days: 42,
          submitted_at: now,
          decision_at: now,
          created_at: now,
          updated_at: now,
        },
      ]);

      const milestoneIds = [uuid(), uuid()];
      await queryInterface.bulkInsert('project_milestones', [
        {
          id: milestoneIds[0],
          project_id: projectId,
          title: 'Discovery & Wireframes',
          description: 'User research, journey mapping, and responsive wireframes.',
          amount: 4000,
          currency: 'USD',
          due_date: new Date(now.getTime() + 14 * 24 * 3600 * 1000),
          order_index: 1,
          status: 'completed',
          released_at: now,
          completed_at: now,
          created_at: now,
          updated_at: now,
        },
        {
          id: milestoneIds[1],
          project_id: projectId,
          title: 'Visual Design & Build',
          description: 'High-fidelity designs and implementation in Webflow.',
          amount: 6500,
          currency: 'USD',
          due_date: new Date(now.getTime() + 42 * 24 * 3600 * 1000),
          order_index: 2,
          status: 'in_progress',
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('project_deliverables', [
        {
          id: uuid(),
          project_id: projectId,
          milestone_id: milestoneIds[0],
          submitted_by: freelancerId,
          title: 'Wireframe Prototype',
          description: 'Interactive wireframes covering primary flows.',
          status: 'approved',
          file_urls: encodeJson([
            { name: 'wireframes.fig', url: 'https://cdn.gigvora.test/wireframes.fig' },
          ]),
          approved_at: now,
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('project_time_logs', [
        {
          id: uuid(),
          project_id: projectId,
          user_id: freelancerId,
          started_at: new Date(now.getTime() - 3 * 3600 * 1000),
          ended_at: now,
          duration_minutes: 180,
          notes: 'Wireframe polish and stakeholder review.',
          hourly_rate: 85,
          billable_amount: 255,
          invoice_status: 'invoiced',
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('project_reviews', [
        {
          id: uuid(),
          project_id: projectId,
          reviewer_id: clientId,
          reviewee_id: freelancerId,
          rating: 5,
          communication_rating: 5,
          quality_rating: 5,
          adherence_rating: 4,
          comment: 'Outstanding collaboration and quality of work so far.',
          created_at: now,
          updated_at: now,
        },
      ]);
    }

    const [[existingGig] = []] = await queryInterface.sequelize.query(
      "SELECT id FROM gigs WHERE title = 'Premium Brand Identity' LIMIT 1"
    );

    if (!existingGig?.id) {
      const gigId = uuid();
      await queryInterface.bulkInsert('gigs', [
        {
          id: gigId,
          seller_id: sellerId,
          title: 'Premium Brand Identity',
          slug: 'premium-brand-identity',
          description:
            'End-to-end brand identity including logo system, typography, color palette, and social templates.',
          category: 'design',
          subcategory: 'branding',
          status: 'active',
          price_min: 1200,
          price_max: 3200,
          currency: 'USD',
          delivery_time_days: 21,
          tags_count: 3,
          orders_count: 1,
          reviews_count: 1,
          rating_average: 4.9,
          views_count: 180,
          clicks_count: 42,
          favorites_count: 23,
          metadata: encodeJson({ source: 'seed' }),
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('gig_tags', [
        { id: uuid(), gig_id: gigId, tag: 'branding', created_at: now, updated_at: now },
        { id: uuid(), gig_id: gigId, tag: 'identity', created_at: now, updated_at: now },
        { id: uuid(), gig_id: gigId, tag: 'logo', created_at: now, updated_at: now },
      ]);

      const packageIds = {
        basic: uuid(),
        standard: uuid(),
        premium: uuid(),
      };

      await queryInterface.bulkInsert('gig_packages', [
        {
          id: packageIds.basic,
          gig_id: gigId,
          tier: 'basic',
          name: 'Brand Essentials',
          description: 'Logo refresh, color palette, and typography recommendations.',
          price: 1200,
          currency: 'USD',
          delivery_days: 7,
          revisions: 2,
          features: encodeJson(['Logo refresh', 'Color palette', 'Typography guide']),
          is_active: true,
          created_at: now,
          updated_at: now,
        },
        {
          id: packageIds.standard,
          gig_id: gigId,
          tier: 'standard',
          name: 'Growth Brand Kit',
          description: 'Essentials plus pattern library and social templates.',
          price: 2100,
          currency: 'USD',
          delivery_days: 14,
          revisions: 3,
          features: encodeJson(['Everything in Essentials', 'Pattern library', 'Social kit']),
          is_active: true,
          created_at: now,
          updated_at: now,
        },
        {
          id: packageIds.premium,
          gig_id: gigId,
          tier: 'premium',
          name: 'Investor Ready Identity',
          description: 'Comprehensive identity system, pitch assets, and launch toolkit.',
          price: 3200,
          currency: 'USD',
          delivery_days: 21,
          revisions: 4,
          features: encodeJson(['Full identity system', 'Pitch deck slides', 'Launch toolkit']),
          is_active: true,
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('gig_addons', [
        {
          id: uuid(),
          gig_id: gigId,
          title: 'Rush Delivery',
          description: 'Deliver the selected package 5 days faster.',
          price: 450,
          currency: 'USD',
          delivery_days: 5,
          is_active: true,
          created_at: now,
          updated_at: now,
        },
        {
          id: uuid(),
          gig_id: gigId,
          title: 'Brand Guidelines Document',
          description: 'Polished PDF brand book ready for stakeholders.',
          price: 380,
          currency: 'USD',
          delivery_days: 3,
          is_active: true,
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('gig_faqs', [
        {
          id: uuid(),
          gig_id: gigId,
          question: 'Can you work with existing brand assets?',
          answer: 'Absolutely, I audit current materials and recommend iterative updates.',
          order_index: 1,
          created_at: now,
          updated_at: now,
        },
        {
          id: uuid(),
          gig_id: gigId,
          question: 'Do you support ongoing retainers?',
          answer: 'Yes, I offer retainers for ongoing design support after delivery.',
          order_index: 2,
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('gig_media', [
        {
          id: uuid(),
          gig_id: gigId,
          media_type: 'image',
          url: 'https://cdn.gigvora.test/brand-cover.png',
          thumbnail_url: 'https://cdn.gigvora.test/brand-cover-thumb.png',
          order_index: 1,
          metadata: encodeJson({ alt: 'Brand identity preview' }),
          created_at: now,
          updated_at: now,
        },
      ]);

      const orderId = uuid();
      await queryInterface.bulkInsert('gig_orders', [
        {
          id: orderId,
          gig_id: gigId,
          package_id: packageIds.premium,
          buyer_id: buyerId,
          seller_id: sellerId,
          package_tier: 'premium',
          price: 3200,
          currency: 'USD',
          status: 'delivered',
          requirements: encodeJson({ brand_story: 'Bold, tech-forward, friendly.' }),
          requirements_submitted_at: now,
          started_at: now,
          due_at: new Date(now.getTime() + 21 * 24 * 3600 * 1000),
          delivered_at: now,
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('gig_submissions', [
        {
          id: uuid(),
          order_id: orderId,
          submitted_by: sellerId,
          message: 'Please review the full identity pack and provide feedback.',
          attachments: encodeJson([
            { name: 'brand-kit.zip', url: 'https://cdn.gigvora.test/brand-kit.zip' },
          ]),
          status: 'submitted',
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('gig_reviews', [
        {
          id: uuid(),
          order_id: orderId,
          gig_id: gigId,
          reviewer_id: buyerId,
          reviewee_id: sellerId,
          rating: 5,
          communication_rating: 5,
          quality_rating: 5,
          value_rating: 4,
          comment: 'Exceptional brand identity work, fast turnaround and thoughtful strategy.',
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('gig_metrics', [
        {
          id: uuid(),
          gig_id: gigId,
          metric_date: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          views: 120,
          clicks: 35,
          orders: 1,
          revenue: 3200,
          created_at: now,
          updated_at: now,
        },
        {
          id: uuid(),
          gig_id: gigId,
          metric_date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
          views: 60,
          clicks: 7,
          orders: 0,
          revenue: 0,
          created_at: now,
          updated_at: now,
        },
      ]);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('project_reviews', {
      comment: 'Outstanding collaboration and quality of work so far.',
    });
    await queryInterface.bulkDelete('project_time_logs', {
      notes: 'Wireframe polish and stakeholder review.',
    });
    await queryInterface.bulkDelete('project_deliverables', {
      title: 'Wireframe Prototype',
    });
    await queryInterface.bulkDelete('project_milestones', {
      title: ['Discovery & Wireframes', 'Visual Design & Build'],
    });
    await queryInterface.bulkDelete('project_bids', {
      cover_letter: 'Excited to collaborate on this redesign. See attached concepts.',
    });
    await queryInterface.bulkDelete('project_invites', {
      message: 'We would love to have you bid on this project.',
    });
    await queryInterface.bulkDelete('project_tags', {
      tag: ['design', 'webflow'],
    });
    await queryInterface.bulkDelete('projects', {
      title: 'Website Redesign Initiative',
    });

    await queryInterface.bulkDelete('gig_reviews', {
      comment: 'Exceptional brand identity work, fast turnaround and thoughtful strategy.',
    });
    await queryInterface.bulkDelete('gig_submissions', {
      message: 'Please review the full identity pack and provide feedback.',
    });
    await queryInterface.bulkDelete('gig_orders', {
      price: 3200,
      package_tier: 'premium',
    });
    await queryInterface.bulkDelete('gig_media', {
      url: 'https://cdn.gigvora.test/brand-cover.png',
    });
    await queryInterface.bulkDelete('gig_faqs', {
      question: ['Can you work with existing brand assets?', 'Do you support ongoing retainers?'],
    });
    await queryInterface.bulkDelete('gig_addons', {
      title: ['Rush Delivery', 'Brand Guidelines Document'],
    });
    await queryInterface.bulkDelete('gig_packages', {
      name: ['Brand Essentials', 'Growth Brand Kit', 'Investor Ready Identity'],
    });
    await queryInterface.bulkDelete('gig_tags', {
      tag: ['branding', 'identity', 'logo'],
    });
    await queryInterface.bulkDelete('gig_metrics', {
      revenue: [3200, 0],
    });
    await queryInterface.bulkDelete('gigs', {
      title: 'Premium Brand Identity',
    });

    await queryInterface.bulkDelete('profiles', {
      display_name: [
        'Marketplace Client',
        'Marketplace Freelancer',
        'Marketplace Seller',
        'Marketplace Buyer',
      ],
    });
    await queryInterface.bulkDelete('users', {
      email: [
        'client.marketplace@gigvora.test',
        'freelancer.marketplace@gigvora.test',
        'seller.marketplace@gigvora.test',
        'buyer.marketplace@gigvora.test',
      ],
    });
  },
};
