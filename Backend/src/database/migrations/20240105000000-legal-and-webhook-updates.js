'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();
    const { UUID, STRING, TEXT, DATE, JSONB, JSON, INTEGER } = Sequelize;
    const jsonType = dialect === 'postgres' ? JSONB : JSON;
    const uuidType = dialect === 'sqlite' ? STRING : UUID;
    const uuidDefault = Sequelize.UUIDV4;

    await queryInterface.createTable('legal_documents', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      slug: { type: STRING, allowNull: false },
      title: { type: STRING, allowNull: false },
      summary: { type: TEXT },
      content: { type: TEXT, allowNull: false },
      version: { type: STRING, allowNull: false },
      status: { type: STRING, allowNull: false, defaultValue: 'published' },
      effective_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      published_at: { type: DATE },
      metadata: { type: jsonType },
      deleted_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('legal_documents', ['slug']);
    await queryInterface.addConstraint('legal_documents', {
      type: 'unique',
      fields: ['slug', 'version'],
      name: 'legal_documents_slug_version_key',
    });

    await queryInterface.createTable('legal_consents', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      user_id: { type: uuidType, allowNull: false },
      document_id: { type: uuidType, allowNull: false },
      document_slug: { type: STRING, allowNull: false },
      document_version: { type: STRING, allowNull: false },
      ip_address: { type: STRING },
      user_agent: { type: STRING },
      metadata: { type: jsonType },
      consented_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      revoked_at: { type: DATE },
      deleted_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('legal_consents', ['document_slug']);
    await queryInterface.addIndex('legal_consents', ['user_id']);
    await queryInterface.addConstraint('legal_consents', {
      fields: ['user_id'],
      type: 'foreign key',
      name: 'legal_consents_user_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });
    await queryInterface.addConstraint('legal_consents', {
      fields: ['document_id'],
      type: 'foreign key',
      name: 'legal_consents_document_id_fkey',
      references: { table: 'legal_documents', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.createTable('webhook_deliveries', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      subscription_id: { type: uuidType, allowNull: false },
      event: { type: STRING, allowNull: false },
      status: { type: STRING, allowNull: false, defaultValue: 'pending' },
      payload: { type: jsonType },
      response_status: { type: INTEGER },
      response_body: { type: jsonType },
      error_message: { type: TEXT },
      retry_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
      duration_ms: { type: INTEGER },
      attempted_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      completed_at: { type: DATE },
      deleted_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('webhook_deliveries', ['subscription_id']);
    await queryInterface.addIndex('webhook_deliveries', ['status']);
    await queryInterface.addConstraint('webhook_deliveries', {
      fields: ['subscription_id'],
      type: 'foreign key',
      name: 'webhook_deliveries_subscription_id_fkey',
      references: { table: 'webhook_subscriptions', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addColumn('webhook_subscriptions', 'owner_id', { type: uuidType, allowNull: true });
    await queryInterface.addColumn('webhook_subscriptions', 'status', {
      type: STRING,
      allowNull: false,
      defaultValue: 'active',
    });
    await queryInterface.addColumn('webhook_subscriptions', 'signing_secret_hash', { type: STRING });
    await queryInterface.addColumn('webhook_subscriptions', 'signing_secret_last4', { type: STRING });
    await queryInterface.addColumn('webhook_subscriptions', 'delivery_attempts', {
      type: INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('webhook_subscriptions', 'last_delivery_at', { type: DATE });
    await queryInterface.addColumn('webhook_subscriptions', 'last_failure_at', { type: DATE });

    await queryInterface.addConstraint('webhook_subscriptions', {
      fields: ['owner_id'],
      type: 'foreign key',
      name: 'webhook_subscriptions_owner_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('webhook_subscriptions', 'webhook_subscriptions_owner_id_fkey');
    await queryInterface.removeColumn('webhook_subscriptions', 'owner_id');
    await queryInterface.removeColumn('webhook_subscriptions', 'status');
    await queryInterface.removeColumn('webhook_subscriptions', 'signing_secret_hash');
    await queryInterface.removeColumn('webhook_subscriptions', 'signing_secret_last4');
    await queryInterface.removeColumn('webhook_subscriptions', 'delivery_attempts');
    await queryInterface.removeColumn('webhook_subscriptions', 'last_delivery_at');
    await queryInterface.removeColumn('webhook_subscriptions', 'last_failure_at');

    await queryInterface.dropTable('webhook_deliveries');
    await queryInterface.dropTable('legal_consents');
    await queryInterface.dropTable('legal_documents');
  },
};
