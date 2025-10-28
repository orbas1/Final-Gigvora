'use strict';

const { v4: uuid } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const dialect = queryInterface.sequelize.getDialect();
    const formatJson = (value) => (dialect === 'sqlite' ? JSON.stringify(value) : value);

    const [marketplaceRows] = await queryInterface.sequelize.query(
      'SELECT id FROM marketplace_configs LIMIT 1'
    );

    if (!marketplaceRows.length) {
      await queryInterface.bulkInsert('marketplace_configs', [
        {
          id: uuid(),
          categories: formatJson([
            { slug: 'design', label: 'Design' },
            { slug: 'development', label: 'Development' },
            { slug: 'marketing', label: 'Marketing' },
          ]),
          floor_prices: formatJson({
            design: { hourly: 40, project: 500 },
            development: { hourly: 60, project: 1000 },
            marketing: { hourly: 35, project: 400 },
          }),
          fee_config: formatJson({
            platform_fee_percent: 12.5,
            premium_fee_percent: 8.5,
            payout_delay_days: 5,
          }),
          created_at: now,
          updated_at: now,
          deleted_at: null,
          updated_by: null,
        },
      ]);
    }

    const platformSettings = [
      {
        key: 'email.templates.welcome',
        category: 'email',
        value: formatJson({ subject: 'Welcome to Gigvora', template: 'welcome' }),
      },
      {
        key: 'roles.matrix',
        category: 'access',
        value: formatJson({
          admin: ['*'],
          moderator: ['moderation:read', 'moderation:write'],
          support: ['tickets:read', 'tickets:write'],
        }),
      },
      {
        key: 'integrations.payment',
        category: 'integrations',
        value: formatJson({ provider: 'stripe', status: 'connected' }),
      },
    ];

    for (const setting of platformSettings) {
      const [existing] = await queryInterface.sequelize.query(
        'SELECT key FROM platform_settings WHERE key = :key LIMIT 1',
        { replacements: { key: setting.key } }
      );
      if (!existing.length) {
        await queryInterface.bulkInsert('platform_settings', [
          {
            key: setting.key,
            category: setting.category,
            value: setting.value,
            created_at: now,
            updated_at: now,
            updated_by: null,
          },
        ]);
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('platform_settings', {
      key: [
        'email.templates.welcome',
        'roles.matrix',
        'integrations.payment',
      ],
    });
    await queryInterface.bulkDelete('marketplace_configs', null, { truncate: true });
  },
};
