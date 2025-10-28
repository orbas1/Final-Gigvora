'use strict';

const { v4: uuid } = require('uuid');

const ACCOUNT_DEFAULTS = {
  language: 'en',
  timezone: 'UTC',
  week_start: 'monday',
  currency: 'USD',
};

const SECURITY_DEFAULTS = {
  two_factor_enabled: false,
  device_verification: true,
  login_notifications: { email: true, push: true },
  allowed_ips: [],
};

const PRIVACY_DEFAULTS = {
  profile_visibility: 'public',
  search_engine_indexing: true,
  message_privacy: 'anyone',
  activity_status: 'online',
  data_sharing: { analytics: true, partners: false },
};

const NOTIFICATION_DEFAULTS = {
  quiet_hours: { enabled: false, from: '22:00', to: '07:00' },
  product_updates: { email: false, in_app: true },
};

const PAYMENTS_DEFAULTS = {
  payout_schedule: 'weekly',
  auto_withdraw: false,
  invoicing: { auto_generate: true, net_terms: 'net_15' },
  tax_profile: {},
};

const THEME_DEFAULTS = {
  mode: 'system',
  accent_color: '#4f46e5',
  density: 'comfortable',
};

const THEME_TOKENS_DEFAULTS = {
  '--color-primary': '#4f46e5',
  '--color-surface': '#ffffff',
  '--color-surface-dark': '#111827',
  '--radius-base': '0.75rem',
  '--shadow-elevation': '0 12px 32px rgba(15, 23, 42, 0.12)',
};

const API_PREFERENCES_DEFAULTS = {
  ip_allowlist: [],
};

module.exports = {
  async up(queryInterface) {
    const dialect = queryInterface.sequelize.getDialect();
    const encodeJson = (value) => {
      if (value === null || value === undefined) return null;
      return dialect === 'sqlite' ? JSON.stringify(value) : value;
    };

    const [users] = await queryInterface.sequelize.query('SELECT id, email FROM users');
    const now = new Date();

    for (const user of users) {
      const [existing] = await queryInterface.sequelize.query(
        'SELECT id FROM user_settings WHERE user_id = :userId LIMIT 1',
        { replacements: { userId: user.id } }
      );

      const payload = {
        user_id: user.id,
        account: encodeJson({ ...ACCOUNT_DEFAULTS, communication_email: user.email }),
        security: encodeJson(SECURITY_DEFAULTS),
        privacy: encodeJson(PRIVACY_DEFAULTS),
        notifications: encodeJson(NOTIFICATION_DEFAULTS),
        payments: encodeJson(PAYMENTS_DEFAULTS),
        theme: encodeJson(THEME_DEFAULTS),
        theme_tokens: encodeJson(THEME_TOKENS_DEFAULTS),
        api_preferences: encodeJson(API_PREFERENCES_DEFAULTS),
        updated_at: now,
      };

      if (!existing.length) {
        await queryInterface.bulkInsert('user_settings', [
          {
            id: uuid(),
            ...payload,
            created_at: now,
          },
        ]);
      } else {
        await queryInterface.bulkUpdate(
          'user_settings',
          payload,
          { user_id: user.id }
        );
      }
    }
  },

  async down() {
    // Settings defaults are non-destructive; no rollback action required.
  },
};
