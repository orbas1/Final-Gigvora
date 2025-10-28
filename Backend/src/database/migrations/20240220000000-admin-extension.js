'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, STRING, TEXT, DATE, BOOLEAN, JSONB, JSON, ENUM, INTEGER, DECIMAL } = Sequelize;
    const dialect = queryInterface.sequelize.getDialect();
    const jsonType = dialect === 'postgres' ? JSONB : JSON;
    const enumType = (values) => (dialect === 'sqlite' ? STRING : ENUM(...values));
    const uuidType = dialect === 'sqlite' ? STRING : UUID;
    const uuidDefault = Sequelize.UUIDV4;

    await queryInterface.createTable('organizations', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      name: { type: STRING, allowNull: false },
      slug: { type: STRING, allowNull: false, unique: true },
      type: { type: enumType(['agency', 'company', 'nonprofit', 'collective']), allowNull: false },
      owner_id: { type: uuidType },
      status: { type: enumType(['active', 'inactive', 'suspended']), defaultValue: 'active' },
      verified_at: { type: DATE },
      metadata: { type: jsonType },
      merged_into_id: { type: uuidType },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('marketplace_configs', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      categories: { type: jsonType, allowNull: false, defaultValue: [] },
      floors: { type: jsonType, allowNull: false, defaultValue: {} },
      fees: { type: jsonType, allowNull: false, defaultValue: {} },
      updated_by: { type: uuidType },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      deleted_at: DATE,
    });

    await queryInterface.createTable('jobs', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      org_id: { type: uuidType, allowNull: false },
      title: { type: STRING, allowNull: false },
      description: TEXT,
      status: { type: enumType(['draft', 'open', 'closed', 'archived']), defaultValue: 'draft' },
      is_sponsored: { type: BOOLEAN, defaultValue: false },
      is_hidden: { type: BOOLEAN, defaultValue: false },
      published_at: DATE,
      budget_min: DECIMAL,
      budget_max: DECIMAL,
      currency: STRING,
      metadata: { type: jsonType },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('content_reports', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      reporter_id: { type: uuidType, allowNull: false },
      subject_type: { type: enumType(['post', 'comment', 'profile', 'message']), allowNull: false },
      subject_id: { type: uuidType, allowNull: false },
      reason: STRING,
      details: TEXT,
      status: { type: enumType(['pending', 'reviewing', 'resolved']), defaultValue: 'pending' },
      action_taken: STRING,
      resolution_notes: TEXT,
      resolved_at: DATE,
      metadata: { type: jsonType },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('payment_transactions', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      type: { type: enumType(['charge', 'payout', 'refund', 'escrow', 'fee']), allowNull: false },
      status: { type: enumType(['pending', 'completed', 'failed', 'cancelled']), defaultValue: 'pending' },
      amount: { type: DECIMAL(15, 2), allowNull: false },
      currency: { type: STRING, allowNull: false },
      user_id: { type: uuidType },
      org_id: { type: uuidType },
      description: STRING,
      metadata: { type: jsonType },
      related_entity: STRING,
      occurred_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('payout_requests', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      transaction_id: { type: uuidType, allowNull: false },
      recipient_id: { type: uuidType, allowNull: false },
      status: { type: enumType(['pending', 'approved', 'rejected', 'paid']), defaultValue: 'pending' },
      notes: TEXT,
      processed_by: { type: uuidType },
      processed_at: DATE,
      metadata: { type: jsonType },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      deleted_at: DATE,
    });

    await queryInterface.createTable('refund_requests', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      transaction_id: { type: uuidType, allowNull: false },
      requester_id: { type: uuidType, allowNull: false },
      status: { type: enumType(['pending', 'approved', 'rejected', 'processed']), defaultValue: 'pending' },
      reason: TEXT,
      processed_by: { type: uuidType },
      processed_at: DATE,
      metadata: { type: jsonType },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      deleted_at: DATE,
    });

    await queryInterface.createTable('disputes', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      reference_type: { type: STRING, allowNull: false },
      reference_id: { type: uuidType, allowNull: false },
      claimant_id: { type: uuidType, allowNull: false },
      respondent_id: { type: uuidType, allowNull: false },
      status: { type: enumType(['open', 'investigating', 'resolved', 'declined']), defaultValue: 'open' },
      resolution: TEXT,
      resolved_at: DATE,
      metadata: { type: jsonType },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      deleted_at: DATE,
    });

    await queryInterface.createTable('moderation_strikes', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      user_id: { type: uuidType, allowNull: false },
      reason: { type: STRING, allowNull: false },
      severity: { type: enumType(['minor', 'major', 'critical']), defaultValue: 'minor' },
      status: { type: enumType(['active', 'cleared']), defaultValue: 'active' },
      issued_by: { type: uuidType, allowNull: false },
      expires_at: DATE,
      metadata: { type: jsonType },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      deleted_at: DATE,
    });

    await queryInterface.createTable('platform_settings', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      email_templates: { type: jsonType, allowNull: false, defaultValue: {} },
      roles: { type: jsonType, allowNull: false, defaultValue: {} },
      integrations: { type: jsonType, allowNull: false, defaultValue: {} },
      updated_by: { type: uuidType },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      deleted_at: DATE,
    });

    await queryInterface.createTable('audit_logs', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      actor_id: { type: uuidType },
      actor_type: { type: STRING },
      entity_type: { type: STRING },
      entity_id: { type: uuidType },
      action: { type: STRING, allowNull: false },
      metadata: { type: jsonType },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      deleted_at: DATE,
    });

    await queryInterface.createTable('search_queries', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      query: { type: STRING, allowNull: false },
      user_id: { type: uuidType },
      results_count: INTEGER,
      zero_result: { type: BOOLEAN, defaultValue: false },
      searched_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      deleted_at: DATE,
    });

    await queryInterface.createTable('platform_metrics', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      metric: { type: STRING, allowNull: false },
      value: { type: DECIMAL(20, 4), allowNull: false },
      recorded_for: { type: DATE, allowNull: false },
      dimension: { type: STRING },
      metadata: { type: jsonType },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      deleted_at: DATE,
    });

    await queryInterface.addIndex('organizations', ['status']);
    await queryInterface.addIndex('jobs', ['status', 'is_sponsored', 'is_hidden']);
    await queryInterface.addIndex('content_reports', ['status']);
    await queryInterface.addIndex('payment_transactions', ['type', 'status']);
    await queryInterface.addIndex('payout_requests', ['status']);
    await queryInterface.addIndex('refund_requests', ['status']);
    await queryInterface.addIndex('disputes', ['status']);
    await queryInterface.addIndex('moderation_strikes', ['user_id', 'status']);
    await queryInterface.addIndex('audit_logs', ['actor_id', 'entity_type', 'entity_id']);
    await queryInterface.addIndex('search_queries', ['searched_at']);
    await queryInterface.addIndex('platform_metrics', ['metric', 'recorded_for']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('platform_metrics');
    await queryInterface.dropTable('search_queries');
    await queryInterface.dropTable('audit_logs');
    await queryInterface.dropTable('platform_settings');
    await queryInterface.dropTable('moderation_strikes');
    await queryInterface.dropTable('disputes');
    await queryInterface.dropTable('refund_requests');
    await queryInterface.dropTable('payout_requests');
    await queryInterface.dropTable('payment_transactions');
    await queryInterface.dropTable('content_reports');
    await queryInterface.dropTable('jobs');
    await queryInterface.dropTable('marketplace_configs');
    await queryInterface.dropTable('organizations');
  },
};
