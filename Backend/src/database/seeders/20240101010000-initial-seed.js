'use strict';

const bcrypt = require('bcrypt');
const { v4: uuid } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const password = await bcrypt.hash('Admin123!', 10);
    const adminId = uuid();
    const [existing] = await queryInterface.sequelize.query('SELECT id FROM users WHERE email = :email', {
      replacements: { email: 'admin@gigvora.test' },
    });

    if (!existing.length) {
      const now = new Date();
      const agencyOrgId = uuid();
      const companyOrgId = uuid();
      await queryInterface.bulkInsert('users', [
        {
          id: adminId,
          email: 'admin@gigvora.test',
          password_hash: password,
          role: 'admin',
          active_role: 'admin',
          org_id: agencyOrgId,
          is_verified: true,
          status: 'active',
          created_at: now,
          updated_at: now,
        },
      ]);

      const profileId = uuid();
      await queryInterface.bulkInsert('profiles', [
        {
          id: profileId,
          user_id: adminId,
          display_name: 'Administrator',
          headline: 'Platform Administrator',
          location: 'Remote',
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('freelancer_profiles', [
        {
          id: uuid(),
          profile_id: profileId,
          headline: 'Platform Administration Specialist',
          availability_status: 'limited',
          specialties: JSON.stringify(['operations', 'compliance']),
          languages: JSON.stringify(['English']),
          rate_card: JSON.stringify({ hourly: 0, currency: 'USD' }),
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('agency_profiles', [
        {
          id: uuid(),
          org_id: agencyOrgId,
          owner_user_id: adminId,
          name: 'Gigvora Platform Agency',
          overview:
            'Internal agency overseeing marketplace quality, compliance, and strategic engagements for top clients.',
          website: 'https://gigvora.test/agency',
          timezone: 'UTC',
          social_links: JSON.stringify({ linkedin: 'https://linkedin.com/company/gigvora' }),
          rate_card: JSON.stringify({
            advisory: { currency: 'USD', hourly: 0 },
            audit: { currency: 'USD', project: 0 },
          }),
          metrics_snapshot: JSON.stringify({ managedTalent: 125, activeEngagements: 12 }),
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('company_profiles', [
        {
          id: uuid(),
          org_id: companyOrgId,
          owner_user_id: adminId,
          legal_name: 'Gigvora Holdings Inc.',
          brand_name: 'Gigvora',
          overview:
            'Global marketplace helping independent talent and teams collaborate with fast-growing companies.',
          website: 'https://gigvora.test',
          industry: 'Technology',
          team_size: 180,
          headquarters: 'Remote-first',
          hiring_needs: JSON.stringify({ roles: ['Full-stack Engineer', 'Customer Success Lead'] }),
          benefits: JSON.stringify({ remote: true, stipends: ['coworking', 'health'] }),
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('profile_experiences', [
        {
          id: uuid(),
          profile_id: profileId,
          title: 'Head of Platform Operations',
          company: 'Gigvora',
          start_date: new Date(now.getFullYear() - 2, 0, 1),
          is_current: true,
          description: 'Oversees marketplace health, compliance, and service quality.',
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('profile_education', [
        {
          id: uuid(),
          profile_id: profileId,
          school: 'University of Platforms',
          degree: 'MBA',
          field: 'Marketplace Strategy',
          start_date: new Date(now.getFullYear() - 6, 8, 1),
          end_date: new Date(now.getFullYear() - 4, 5, 1),
          created_at: now,
          updated_at: now,
        },
      ]);

      const opsTagId = uuid();
      const leadershipTagId = uuid();
      await queryInterface.bulkInsert('tags', [
        {
          id: opsTagId,
          name: 'operations',
          description: 'Operational excellence and process design',
          created_at: now,
          updated_at: now,
        },
        {
          id: leadershipTagId,
          name: 'leadership',
          description: 'Executive leadership and management',
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('profile_tags', [
        {
          profile_id: profileId,
          tag_id: opsTagId,
          created_at: now,
          updated_at: now,
        },
        {
          profile_id: profileId,
          tag_id: leadershipTagId,
          created_at: now,
          updated_at: now,
        },
      ]);

      const operationsSkillId = uuid();
      const complianceSkillId = uuid();
      await queryInterface.bulkInsert('skills', [
        {
          id: operationsSkillId,
          name: 'Platform Operations',
          description: 'Scaling and monitoring platform activity.',
          created_at: now,
          updated_at: now,
        },
        {
          id: complianceSkillId,
          name: 'Regulatory Compliance',
          description: 'Ensuring compliance with marketplace regulations.',
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('profile_skills', [
        {
          profile_id: profileId,
          skill_id: operationsSkillId,
          proficiency: 'expert',
          created_at: now,
          updated_at: now,
        },
        {
          profile_id: profileId,
          skill_id: complianceSkillId,
          proficiency: 'advanced',
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('portfolio_items', [
        {
          id: uuid(),
          profile_id: profileId,
          title: 'Incident Response Framework',
          description: 'A documented framework covering 24/7 on-call rotations and communication protocols.',
          url: 'https://gigvora.test/playbooks/incident-response',
          media: JSON.stringify({ type: 'document', storage_key: 'playbooks/incident-response.pdf' }),
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('profile_views', [
        {
          id: uuid(),
          profile_id: profileId,
          viewer_id: adminId,
          source: 'seed',
          viewed_at: now,
          created_at: now,
          updated_at: now,
        },
      ]);
    }
  },

  async down(queryInterface) {
    const [[user]] = await queryInterface.sequelize.query('SELECT id FROM users WHERE email = :email', {
      replacements: { email: 'admin@gigvora.test' },
    });

    if (user) {
      const [[profile]] = await queryInterface.sequelize.query('SELECT id FROM profiles WHERE user_id = :userId', {
        replacements: { userId: user.id },
      });

      if (profile) {
        await queryInterface.bulkDelete('profile_views', { profile_id: profile.id });
        await queryInterface.bulkDelete('portfolio_items', { profile_id: profile.id });
        await queryInterface.bulkDelete('profile_skills', { profile_id: profile.id });
        await queryInterface.bulkDelete('profile_tags', { profile_id: profile.id });
        await queryInterface.bulkDelete('profile_education', { profile_id: profile.id });
        await queryInterface.bulkDelete('profile_experiences', { profile_id: profile.id });
        await queryInterface.bulkDelete('freelancer_profiles', { profile_id: profile.id });
        await queryInterface.bulkDelete('agency_profiles', { owner_user_id: user.id });
        await queryInterface.bulkDelete('company_profiles', { owner_user_id: user.id });
        await queryInterface.bulkDelete('profiles', { id: profile.id });
      }

      await queryInterface.bulkDelete('skills', {
        name: ['Platform Operations', 'Regulatory Compliance'],
      });
      await queryInterface.bulkDelete('tags', { name: ['operations', 'leadership'] });
      await queryInterface.bulkDelete('users', { id: user.id });
    }
  },
};
