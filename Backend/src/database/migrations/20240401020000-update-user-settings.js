'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();
    const { UUID, STRING, DATE, JSONB, JSON } = Sequelize;
    const jsonType = dialect === 'postgres' ? JSONB : JSON;
    const uuidType = dialect === 'sqlite' ? STRING : UUID;
    const uuidDefault = Sequelize.UUIDV4;

    const settingsTable = await queryInterface.describeTable('user_settings');

    if (!settingsTable.account) {
      await queryInterface.addColumn('user_settings', 'account', { type: jsonType });
    }
    if (!settingsTable.notifications) {
      await queryInterface.addColumn('user_settings', 'notifications', { type: jsonType });
    }
    if (!settingsTable.payments) {
      await queryInterface.addColumn('user_settings', 'payments', { type: jsonType });
    }

    if (settingsTable.preferences) {
      await queryInterface.removeColumn('user_settings', 'preferences');
    }

    const tables = await queryInterface.showAllTables();
    const hasApiTokens = tables.some((table) => table === 'api_tokens' || table === 'API_TOKENS');

    if (!hasApiTokens) {
      await queryInterface.createTable('api_tokens', {
        id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
        user_id: { type: uuidType, allowNull: false },
        name: { type: STRING, allowNull: false },
        token_hash: { type: STRING, allowNull: false },
        token_prefix: { type: STRING, allowNull: false },
        scopes: { type: jsonType },
        last_used_at: DATE,
        expires_at: DATE,
        created_by_ip: STRING,
        metadata: { type: jsonType },
        revoked_at: DATE,
        deleted_at: DATE,
        created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });

      await queryInterface.addConstraint('api_tokens', {
        fields: ['user_id'],
        type: 'foreign key',
        name: 'api_tokens_user_id_fkey',
        references: { table: 'users', field: 'id' },
        onDelete: 'cascade',
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();
    const { JSONB, JSON } = Sequelize;
    const jsonType = dialect === 'postgres' ? JSONB : JSON;

    const settingsTable = await queryInterface.describeTable('user_settings');

    if (!settingsTable.preferences) {
      await queryInterface.addColumn('user_settings', 'preferences', { type: jsonType });
    }
    if (settingsTable.account) {
      await queryInterface.removeColumn('user_settings', 'account');
    }
    if (settingsTable.notifications) {
      await queryInterface.removeColumn('user_settings', 'notifications');
    }
    if (settingsTable.payments) {
      await queryInterface.removeColumn('user_settings', 'payments');
    }

    const tables = await queryInterface.showAllTables();
    const hasApiTokens = tables.some((table) => table === 'api_tokens' || table === 'API_TOKENS');

    if (hasApiTokens) {
      await queryInterface.dropTable('api_tokens');
    }
  },
};
