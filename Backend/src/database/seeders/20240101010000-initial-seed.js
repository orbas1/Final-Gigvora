'use strict';

const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const now = () => new Date();

const listToText = (list) =>
  list
    .map((entry) => entry && String(entry).trim())
    .filter(Boolean)
    .join(',');

module.exports = {
  async up(queryInterface) {
    const password = await bcrypt.hash('Admin123!', 10);
    const adminEmail = 'admin@gigvora.test';
    const [existingAdmin] = await queryInterface.sequelize.query('SELECT id FROM users WHERE email = :email', {
      replacements: { email: adminEmail },
    });

    let adminId;
    if (!existingAdmin.length) {
      adminId = uuidv4();
      await queryInterface.bulkInsert('users', [
        {
          id: adminId,
          email: adminEmail,
          password_hash: password,
          role: 'admin',
          active_role: 'admin',
          is_verified: true,
          status: 'active',
          created_at: now(),
          updated_at: now(),
        },
      ]);

      await queryInterface.bulkInsert('profiles', [
        {
          id: uuidv4(),
          user_id: adminId,
          display_name: 'Administrator',
          headline: 'Platform Administrator',
          location: 'Remote',
          created_at: now(),
          updated_at: now(),
        },
      ]);
    } else {
      adminId = existingAdmin[0].id;
    }

    const skillSeeds = [
      'JavaScript',
      'UI Design',
      'Product Management',
      'Customer Success',
      'DevOps',
      'Marketing',
      'Engineering',
    ];
    const [existingSkills] = await queryInterface.sequelize.query('SELECT name FROM skills');
    const existingSkillNames = new Set(existingSkills.map((row) => row.name.toLowerCase()));
    const skillsToInsert = skillSeeds
      .filter((name) => !existingSkillNames.has(name.toLowerCase()))
      .map((name) => ({
        id: uuidv4(),
        name,
        description: `${name} proficiency`,
        created_at: now(),
        updated_at: now(),
      }));
    if (skillsToInsert.length) {
      await queryInterface.bulkInsert('skills', skillsToInsert);
    }

    const tagSeeds = ['growth', 'remote', 'design', 'engineering', 'marketing'];
    const [existingTags] = await queryInterface.sequelize.query('SELECT name FROM tags');
    const existingTagNames = new Set(existingTags.map((row) => row.name.toLowerCase()));
    const tagsToInsert = tagSeeds
      .filter((name) => !existingTagNames.has(name.toLowerCase()))
      .map((name) => ({
        id: uuidv4(),
        name,
        description: `${name} focus`,
        created_at: now(),
        updated_at: now(),
      }));
    if (tagsToInsert.length) {
      await queryInterface.bulkInsert('tags', tagsToInsert);
    }

    const freelancerEmail = 'freelancer@gigvora.test';
    const [freelancerRows] = await queryInterface.sequelize.query('SELECT id FROM users WHERE email = :email', {
      replacements: { email: freelancerEmail },
    });

    let freelancerId;
    if (!freelancerRows.length) {
      freelancerId = uuidv4();
      await queryInterface.bulkInsert('users', [
        {
          id: freelancerId,
          email: freelancerEmail,
          password_hash: await bcrypt.hash('Freelancer123!', 10),
          role: 'freelancer',
          active_role: 'freelancer',
          is_verified: true,
          status: 'active',
          created_at: now(),
          updated_at: now(),
        },
      ]);

      const profileId = uuidv4();
      await queryInterface.bulkInsert('profiles', [
        {
          id: profileId,
          user_id: freelancerId,
          display_name: 'Casey Rivera',
          headline: 'Full-stack product specialist',
          location: 'Austin, USA',
          hourly_rate: 95,
          currency: 'USD',
          created_at: now(),
          updated_at: now(),
        },
      ]);

      const [skillRows] = await queryInterface.sequelize.query('SELECT id, name FROM skills WHERE name IN (:names)', {
        replacements: { names: ['JavaScript', 'Product Management'] },
      });
      if (skillRows.length) {
        await queryInterface.bulkInsert(
          'profile_skills',
          skillRows.map((skill) => ({
            profile_id: profileId,
            skill_id: skill.id,
            proficiency: 'expert',
            created_at: now(),
            updated_at: now(),
          }))
        );
      }

      const [tagRows] = await queryInterface.sequelize.query('SELECT id FROM tags WHERE name IN (:names)', {
        replacements: { names: ['growth', 'engineering'] },
      });
      if (tagRows.length) {
        await queryInterface.bulkInsert(
          'profile_tags',
          tagRows.map((tag) => ({
            profile_id: profileId,
            tag_id: tag.id,
            created_at: now(),
            updated_at: now(),
          }))
        );
      }
    } else {
      freelancerId = freelancerRows[0].id;
    }

    const [existingOrganizations] = await queryInterface.sequelize.query('SELECT name, id FROM organizations');
    const orgNameToId = new Map(existingOrganizations.map((row) => [row.name, row.id]));
    const organizationSeeds = [
      {
        name: 'Atlas Innovations',
        type: 'company',
        headline: 'Digital product studio',
        description: 'We partner with growth teams to launch customer-centric web and mobile experiences.',
        location: 'San Francisco, USA',
        website: 'https://atlas.example.com',
        tags: listToText(['engineering', 'design']),
        size: '51-200',
        industry: 'Technology',
      },
      {
        name: 'Northwind Collective',
        type: 'agency',
        headline: 'Remote-first agency network',
        description: 'Distributed specialists delivering async-first operations, marketing, and support.',
        location: 'Remote',
        website: 'https://northwind.example.com',
        tags: listToText(['remote', 'marketing']),
        size: '11-50',
        industry: 'Services',
      },
    ];

    const organizationsToInsert = organizationSeeds
      .filter((org) => !orgNameToId.has(org.name))
      .map((org) => ({
        id: uuidv4(),
        type: org.type,
        name: org.name,
        headline: org.headline,
        description: org.description,
        location: org.location,
        website: org.website,
        tags: org.tags,
        size: org.size,
        industry: org.industry,
        created_at: now(),
        updated_at: now(),
      }));

    if (organizationsToInsert.length) {
      await queryInterface.bulkInsert('organizations', organizationsToInsert);
      organizationsToInsert.forEach((org) => orgNameToId.set(org.name, org.id));
    }

    const atlasId = orgNameToId.get('Atlas Innovations');
    const northwindId = orgNameToId.get('Northwind Collective');

    const [existingProjects] = await queryInterface.sequelize.query('SELECT title FROM projects');
    const existingProjectTitles = new Set(existingProjects.map((row) => row.title));
    const projects = [
      {
        title: 'Launch responsive analytics dashboard',
        summary: 'Greenfield dashboard build with realtime collaboration features.',
        description:
          'Atlas Innovations is looking for a senior product team to design and build a responsive analytics dashboard with realtime collaboration, audit trails, and secure access controls.',
        type: 'fixed',
        status: 'open',
        budget_min: 35000,
        budget_max: 50000,
        currency: 'USD',
        location: 'Remote',
        skills: listToText(['JavaScript', 'Product Management']),
        tags: listToText(['engineering', 'growth']),
        client_id: adminId,
        organization_id: atlasId || null,
      },
      {
        title: 'Customer lifecycle audit and journey mapping',
        summary: 'Evaluate lifecycle funnels across self-serve and sales motions.',
        description:
          'Northwind Collective needs a cross-functional expert to audit the full customer lifecycle, produce journey maps, and recommend instrumentation improvements.',
        type: 'hourly',
        status: 'in_progress',
        budget_min: 80,
        budget_max: 125,
        currency: 'USD',
        location: 'Remote',
        skills: listToText(['Customer Success', 'Product Management']),
        tags: listToText(['growth', 'remote']),
        client_id: freelancerId,
        organization_id: northwindId || null,
      },
    ]
      .filter((project) => !existingProjectTitles.has(project.title))
      .map((project) => ({
        id: uuidv4(),
        ...project,
        created_at: now(),
        updated_at: now(),
      }));

    if (projects.length) {
      await queryInterface.bulkInsert('projects', projects);
    }

    const [existingGigs] = await queryInterface.sequelize.query('SELECT title FROM gigs');
    const existingGigTitles = new Set(existingGigs.map((row) => row.title));
    const gigs = [
      {
        title: 'Fractional product strategy sprint',
        slug: 'fractional-product-strategy-sprint',
        description: 'Two-week sprint delivering roadmap, customer insights, and enablement assets.',
        rate_amount: 6200,
        rate_unit: 'package',
        location: 'Hybrid - Austin, USA',
        delivery_time_days: 14,
        status: 'active',
        skills: listToText(['Product Management', 'Customer Success']),
        tags: listToText(['growth']),
        seller_id: freelancerId,
        organization_id: northwindId || null,
      },
    ]
      .filter((gig) => !existingGigTitles.has(gig.title))
      .map((gig) => ({
        id: uuidv4(),
        ...gig,
        created_at: now(),
        updated_at: now(),
      }));

    if (gigs.length) {
      await queryInterface.bulkInsert('gigs', gigs);
    }

    const [existingJobs] = await queryInterface.sequelize.query('SELECT title FROM jobs');
    const existingJobTitles = new Set(existingJobs.map((row) => row.title));
    const jobs = [
      {
        title: 'Director of Lifecycle Marketing',
        slug: 'director-of-lifecycle-marketing',
        description:
          'Own the lifecycle marketing roadmap across email, in-product, and community channels with deep experimentation focus.',
        employment_type: 'full_time',
        location: 'San Francisco, USA',
        remote: true,
        salary_min: 165000,
        salary_max: 195000,
        currency: 'USD',
        skills: listToText(['Marketing', 'Customer Success']),
        tags: listToText(['growth', 'remote']),
        status: 'open',
        posted_at: now(),
        company_id: atlasId,
      },
      {
        title: 'Senior Platform Engineer (Freelance)',
        slug: 'senior-platform-engineer-freelance',
        description:
          'Remote contract role to harden infrastructure, improve observability, and mentor junior engineers.',
        employment_type: 'contract',
        location: 'Remote',
        remote: true,
        salary_min: 90,
        salary_max: 130,
        currency: 'USD',
        skills: listToText(['DevOps', 'Engineering']),
        tags: listToText(['engineering', 'remote']),
        status: 'open',
        posted_at: now(),
        company_id: northwindId,
      },
    ]
      .filter((job) => !existingJobTitles.has(job.title))
      .map((job) => ({
        id: uuidv4(),
        ...job,
        created_at: now(),
        updated_at: now(),
      }));

    if (jobs.length) {
      await queryInterface.bulkInsert('jobs', jobs);
    }

    const [existingGroups] = await queryInterface.sequelize.query('SELECT slug FROM groups');
    const existingGroupSlugs = new Set(existingGroups.map((row) => row.slug));
    const groups = [
      {
        name: 'Revenue Leaders Guild',
        slug: 'revenue-leaders-guild',
        description: 'Invite-only forum for revenue leaders to share benchmarks and playbooks.',
        privacy: 'private',
        location: 'Remote',
        tags: listToText(['growth', 'remote']),
        member_count: 128,
        owner_id: adminId,
      },
      {
        name: 'Async Ops Collective',
        slug: 'async-ops-collective',
        description: 'Community for remote-first operators refining async collaboration practices.',
        privacy: 'public',
        location: 'Remote',
        tags: listToText(['remote']),
        member_count: 243,
        owner_id: freelancerId,
      },
    ]
      .filter((group) => !existingGroupSlugs.has(group.slug))
      .map((group) => ({
        id: uuidv4(),
        ...group,
        created_at: now(),
        updated_at: now(),
      }));

    if (groups.length) {
      await queryInterface.bulkInsert('groups', groups);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('groups', null, {});
    await queryInterface.bulkDelete('jobs', null, {});
    await queryInterface.bulkDelete('gigs', null, {});
    await queryInterface.bulkDelete('projects', null, {});
    await queryInterface.bulkDelete('organizations', null, {});
    await queryInterface.bulkDelete('profile_tags', null, {});
    await queryInterface.bulkDelete('profile_skills', null, {});
    await queryInterface.bulkDelete('profiles', null, {});
    await queryInterface.bulkDelete('users', { email: ['admin@gigvora.test', 'freelancer@gigvora.test'] }, {});
    await queryInterface.bulkDelete('tags', null, {});
    await queryInterface.bulkDelete('skills', null, {});
  },
};
