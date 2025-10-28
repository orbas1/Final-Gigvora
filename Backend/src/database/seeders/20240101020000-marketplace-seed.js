'use strict';

const { v4: uuid } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [adminRow] = await queryInterface.sequelize.query(
      'SELECT id, email FROM users WHERE email = :email LIMIT 1',
      { replacements: { email: 'admin@gigvora.test' } }
    );
    const admin = adminRow?.[0];
    if (!admin) {
      return;
    }

    const tags = [
      { name: 'design', description: 'Design & creative services' },
      { name: 'development', description: 'Software and application development' },
      { name: 'marketing', description: 'Growth and marketing expertise' },
    ];

    const tagMap = {};
    for (const tag of tags) {
      const [existing] = await queryInterface.sequelize.query('SELECT id FROM tags WHERE name = :name LIMIT 1', {
        replacements: { name: tag.name },
      });
      if (existing.length) {
        tagMap[tag.name] = existing[0].id;
      } else {
        const id = uuid();
        tagMap[tag.name] = id;
        await queryInterface.bulkInsert('tags', [
          { id, name: tag.name, description: tag.description, created_at: now, updated_at: now },
        ]);
      }
    }

    const [projectExisting] = await queryInterface.sequelize.query(
      "SELECT id FROM projects WHERE title = 'Demo Branding Project' LIMIT 1"
    );

    let projectId = projectExisting?.[0]?.id;
    if (!projectId) {
      projectId = uuid();
      await queryInterface.bulkInsert('projects', [
        {
          id: projectId,
          owner_id: admin.id,
          title: 'Demo Branding Project',
          description: 'Create a cohesive brand kit including logo, typography, and social templates.',
          type: 'fixed',
          status: 'open',
          budget_min: 1500,
          budget_max: 3000,
          currency: 'USD',
          location: 'Remote',
          published_at: now,
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('project_milestones', [
        {
          id: uuid(),
          project_id: projectId,
          title: 'Discovery & Moodboard',
          amount: 500,
          currency: 'USD',
          due_date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          status: 'pending',
          sequence: 1,
          created_at: now,
          updated_at: now,
        },
        {
          id: uuid(),
          project_id: projectId,
          title: 'Logo Concepts',
          amount: 1000,
          currency: 'USD',
          due_date: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
          status: 'pending',
          sequence: 2,
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('project_tags', [
        {
          project_id: projectId,
          tag_id: tagMap.design,
          created_at: now,
          updated_at: now,
        },
        {
          project_id: projectId,
          tag_id: tagMap.marketing,
          created_at: now,
          updated_at: now,
        },
      ]);
    }

    const [gigExisting] = await queryInterface.sequelize.query(
      "SELECT id FROM gigs WHERE title = 'Full Stack Website Build' LIMIT 1"
    );

    if (!gigExisting.length) {
      const gigId = uuid();
      await queryInterface.bulkInsert('gigs', [
        {
          id: gigId,
          seller_id: admin.id,
          title: 'Full Stack Website Build',
          slug: `full-stack-website-build-${gigId.slice(0, 8)}`,
          description: 'End-to-end website delivery including backend, frontend, and deployment.',
          category: 'Development',
          subcategory: 'Web Development',
          status: 'active',
          price_min: 1200,
          price_max: 5000,
          currency: 'USD',
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('gig_packages', [
        {
          id: uuid(),
          gig_id: gigId,
          tier: 'basic',
          name: 'Starter',
          description: 'Single page site with responsive layout.',
          price: 1200,
          delivery_days: 7,
          revisions: 1,
          features: JSON.stringify([{ feature: 'Responsive design' }]),
          created_at: now,
          updated_at: now,
        },
        {
          id: uuid(),
          gig_id: gigId,
          tier: 'standard',
          name: 'Growth',
          description: 'Multi-page marketing site with CMS integration.',
          price: 2600,
          delivery_days: 14,
          revisions: 2,
          features: JSON.stringify([{ feature: 'CMS integration' }]),
          created_at: now,
          updated_at: now,
        },
        {
          id: uuid(),
          gig_id: gigId,
          tier: 'premium',
          name: 'Scale',
          description: 'Custom application with auth and deployment pipeline.',
          price: 4800,
          delivery_days: 28,
          revisions: 3,
          features: JSON.stringify([{ feature: 'CI/CD setup' }]),
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('gig_tags', [
        {
          gig_id: gigId,
          tag_id: tagMap.development,
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('gig_faq', [
        {
          id: uuid(),
          gig_id: gigId,
          question: 'Do you handle hosting?',
          answer: 'Yes, hosting and deployment are included in all tiers.',
          sort_order: 1,
          created_at: now,
          updated_at: now,
        },
      ]);
    }
  },

  async down(queryInterface) {
    const [[project]] = await Promise.all([
      queryInterface.sequelize.query("SELECT id FROM projects WHERE title = 'Demo Branding Project'"),
    ]);
    if (project?.length) {
      const projectId = project[0].id;
      await queryInterface.bulkDelete('project_tags', { project_id: projectId }, {});
      await queryInterface.bulkDelete('project_milestones', { project_id: projectId }, {});
      await queryInterface.bulkDelete('projects', { id: projectId }, {});
    }

    const [[gig]] = await Promise.all([
      queryInterface.sequelize.query("SELECT id FROM gigs WHERE title = 'Full Stack Website Build'"),
    ]);
    if (gig?.length) {
      const gigId = gig[0].id;
      await queryInterface.bulkDelete('gig_packages', { gig_id: gigId }, {});
      await queryInterface.bulkDelete('gig_tags', { gig_id: gigId }, {});
      await queryInterface.bulkDelete('gig_faq', { gig_id: gigId }, {});
      await queryInterface.bulkDelete('gigs', { id: gigId }, {});
    }
  },
};
