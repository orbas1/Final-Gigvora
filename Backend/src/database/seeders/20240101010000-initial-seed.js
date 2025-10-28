'use strict';

const bcrypt = require('bcrypt');

module.exports = {
  async up(queryInterface) {
    const password = await bcrypt.hash('Admin123!', 10);
    const { v4: uuid } = require('uuid');
    const dialect = queryInterface.sequelize.getDialect();
    const encodeJson = (value) => {
      if (value === undefined || value === null) return null;
      return dialect === 'sqlite' ? JSON.stringify(value) : value;
    };

    const ensureUser = async ({ email, role, displayName, headline, location }) => {
      const [existing] = await queryInterface.sequelize.query('SELECT id FROM users WHERE email = :email', {
        replacements: { email },
      });

      if (existing.length) {
        return existing[0].id;
      }

      const userId = uuid();
      const profileId = uuid();
      await queryInterface.bulkInsert('users', [
        {
          id: userId,
          email,
          password_hash: password,
          role,
          active_role: role,
          is_verified: true,
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      await queryInterface.bulkInsert('profiles', [
        {
          id: profileId,
          user_id: userId,
          display_name: displayName,
          headline,
          location,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      return userId;
    };

    const adminId = await ensureUser({
      email: 'admin@gigvora.test',
      role: 'admin',
      displayName: 'Administrator',
      headline: 'Platform Administrator',
      location: 'Remote',
    });

    const companyOwnerId = await ensureUser({
      email: 'owner@acme.test',
      role: 'client',
      displayName: 'Alex Founder',
      headline: 'Head of Operations',
      location: 'San Francisco, CA',
    });

    const agencyOwnerId = await ensureUser({
      email: 'lead@creativehub.test',
      role: 'freelancer',
      displayName: 'Jamie Creative',
      headline: 'Agency Principal',
      location: 'New York, NY',
    });

    const now = new Date();

    const [existingCompany] = await queryInterface.sequelize.query('SELECT id FROM companies WHERE slug = :slug', {
      replacements: { slug: 'acme-industries' },
    });

    if (!existingCompany.length) {
      const companyId = uuid();
      await queryInterface.bulkInsert('companies', [
        {
          id: companyId,
          owner_id: companyOwnerId,
          name: 'Acme Industries',
          slug: 'acme-industries',
          description: 'Enterprise software company delivering secure collaboration tools.',
          website: 'https://acme.example.com',
          industry: 'Software',
          size: '201-500',
          headquarters: 'San Francisco, CA',
          verified: true,
          verified_at: now,
          logo_url: 'https://cdn.gigvora.test/assets/acme-logo.png',
          banner_url: 'https://cdn.gigvora.test/assets/acme-banner.png',
          metadata: encodeJson({ hiring: true, founded: 2015 }),
          analytics_snapshot: encodeJson({ headcount: 230 }),
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('company_employees', [
        {
          id: uuid(),
          company_id: companyId,
          user_id: companyOwnerId,
          role: 'admin',
          title: 'Founder & CEO',
          joined_at: now,
          invited_by: adminId,
          invited_at: now,
          created_at: now,
          updated_at: now,
        },
        {
          id: uuid(),
          company_id: companyId,
          user_id: adminId,
          role: 'admin',
          title: 'Platform Admin Liaison',
          joined_at: now,
          invited_by: adminId,
          invited_at: now,
          created_at: now,
          updated_at: now,
        },
      ]);
    }

    const [existingAgency] = await queryInterface.sequelize.query('SELECT id FROM agencies WHERE slug = :slug', {
      replacements: { slug: 'creative-hub-studio' },
    });

    if (!existingAgency.length) {
      const agencyId = uuid();
      await queryInterface.bulkInsert('agencies', [
        {
          id: agencyId,
          owner_id: agencyOwnerId,
          name: 'Creative Hub Studio',
          slug: 'creative-hub-studio',
          description: 'Boutique design and marketing collective supporting fast-moving startups.',
          website: 'https://creativehub.example.com',
          services: encodeJson(['Brand Strategy', 'UI/UX Design', 'Content Marketing']),
          specialties: encodeJson(['SaaS', 'E-commerce']),
          location: 'New York, NY',
          verified: true,
          verified_at: now,
          logo_url: 'https://cdn.gigvora.test/assets/creativehub-logo.png',
          banner_url: 'https://cdn.gigvora.test/assets/creativehub-banner.png',
          metadata: encodeJson({ certifications: ['HubSpot', 'Adobe Partner'] }),
          analytics_snapshot: encodeJson({ clients_served: 120 }),
          created_at: now,
          updated_at: now,
        },
      ]);

      await queryInterface.bulkInsert('agency_members', [
        {
          id: uuid(),
          agency_id: agencyId,
          user_id: agencyOwnerId,
          role: 'admin',
          title: 'Managing Director',
          joined_at: now,
          invited_by: adminId,
          invited_at: now,
          created_at: now,
          updated_at: now,
        },
        {
          id: uuid(),
          agency_id: agencyId,
          user_id: adminId,
          role: 'lead',
          title: 'Platform Advocate',
          joined_at: now,
          invited_by: agencyOwnerId,
          invited_at: now,
          created_at: now,
          updated_at: now,
        },
      ]);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('agency_members', null, {});
    await queryInterface.bulkDelete('company_employees', null, {});
    await queryInterface.bulkDelete('agencies', null, {});
    await queryInterface.bulkDelete('companies', null, {});
    await queryInterface.bulkDelete('profiles', null, {});
    await queryInterface.bulkDelete('users', { email: 'admin@gigvora.test' }, {});
    await queryInterface.bulkDelete('users', { email: 'owner@acme.test' }, {});
    await queryInterface.bulkDelete('users', { email: 'lead@creativehub.test' }, {});
  },
};
