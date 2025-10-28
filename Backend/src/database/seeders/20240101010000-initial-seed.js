'use strict';

const bcrypt = require('bcrypt');

module.exports = {
  async up(queryInterface) {
    const password = await bcrypt.hash('Admin123!', 10);
    const adminId = require('uuid').v4();
    const [existing] = await queryInterface.sequelize.query('SELECT id FROM users WHERE email = :email', {
      replacements: { email: 'admin@gigvora.test' },
    });

    if (!existing.length) {
      const isSqlite = queryInterface.sequelize.getDialect() === 'sqlite';
      const toJson = (value) => (isSqlite ? JSON.stringify(value) : value);
      await queryInterface.bulkInsert('users', [
        {
          id: adminId,
          email: 'admin@gigvora.test',
          password_hash: password,
          role: 'admin',
          active_role: 'admin',
          is_verified: true,
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      await queryInterface.bulkInsert('profiles', [
        {
          id: require('uuid').v4(),
          user_id: adminId,
          display_name: 'Administrator',
          headline: 'Platform Administrator',
          location: 'Remote',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      await queryInterface.bulkInsert('user_settings', [
        {
          id: require('uuid').v4(),
          user_id: adminId,
          account: toJson({
            timezone: 'UTC',
            language: 'en',
            marketing_opt_in: false,
            default_currency: 'USD',
            communication_email: 'admin@gigvora.test',
          }),
          security: toJson({
            two_factor_enabled: false,
            login_alerts: true,
            recovery_codes: [],
            recovery_codes_issued_at: null,
            totp_issuer: 'Gigvora',
          }),
          privacy: toJson({
            profile_visibility: 'public',
            search_engine_indexing: true,
            message_privacy: 'connections',
            data_sharing: { analytics: true, partners: false },
            show_profile_to_companies: true,
          }),
          notifications: toJson({
            email: { marketing: false, product_updates: true, security: true, reminders: true },
            push: { mentions: true, messages: true, follows: true },
            sms: { jobs: false, security: true },
            digest_frequency: 'weekly',
          }),
          payments: toJson({
            default_method: null,
            payout_schedule: 'monthly',
            tax_form_status: 'pending',
            automatic_withdrawal: false,
            currency: 'USD',
            billing_address: null,
            linked_accounts: [],
          }),
          theme: toJson({
            mode: 'system',
            primary_color: '#1f2937',
            accent_color: '#3b82f6',
            font_scale: 1,
            border_radius: 6,
            custom_tokens: {},
          }),
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);
    }
  },

  async down(queryInterface) {
    const [{ id: adminId } = {}] = await queryInterface.sequelize.query(
      'SELECT id FROM users WHERE email = :email',
      { type: queryInterface.sequelize.QueryTypes.SELECT, replacements: { email: 'admin@gigvora.test' } }
    );
    if (adminId) {
      await queryInterface.bulkDelete('user_settings', { user_id: adminId }, {});
    }
    await queryInterface.bulkDelete('profiles', null, {});
    await queryInterface.bulkDelete('users', { email: 'admin@gigvora.test' }, {});
  },
};
