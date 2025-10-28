'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const {
      UUID,
      STRING,
      TEXT,
      DATE,
      BOOLEAN,
      JSONB,
      JSON,
      ENUM,
      INTEGER,
      DECIMAL,
    } = Sequelize;

    const dialect = queryInterface.sequelize.getDialect();
    const jsonType = dialect === 'postgres' ? JSONB : JSON;
    const enumType = (values) => (dialect === 'sqlite' ? STRING : ENUM(...values));
    const uuidType = dialect === 'sqlite' ? STRING : UUID;
    const uuidDefault = Sequelize.UUIDV4;

    await queryInterface.addColumn('users', 'banned_at', { type: DATE, allowNull: true });
    await queryInterface.addColumn('users', 'ban_expires_at', { type: DATE, allowNull: true });
    await queryInterface.addColumn('users', 'banned_reason', { type: TEXT, allowNull: true });

    await queryInterface.addColumn('sessions', 'impersonated_by', {
      type: uuidType,
      allowNull: true,
    });
    await queryInterface.addColumn('sessions', 'impersonated_at', {
      type: DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('jobs', 'is_sponsored', {
      type: BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('jobs', 'hidden_at', {
      type: DATE,
      allowNull: true,
    });

    await queryInterface.createTable('marketplace_configs', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      categories: { type: jsonType, allowNull: false, defaultValue: dialect === 'sqlite' ? '[]' : [] },
      floor_prices: { type: jsonType, allowNull: false, defaultValue: dialect === 'sqlite' ? '{}' : {} },
      fee_config: { type: jsonType, allowNull: false, defaultValue: dialect === 'sqlite' ? '{}' : {} },
      updated_by: { type: uuidType, allowNull: true },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      deleted_at: { type: DATE, allowNull: true },
    });

    await queryInterface.createTable('platform_settings', {
      key: { type: STRING, primaryKey: true },
      category: { type: STRING, allowNull: false },
      value: { type: jsonType, allowNull: true },
      updated_by: { type: uuidType, allowNull: true },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('moderation_strikes', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      user_id: { type: uuidType, allowNull: false },
      issued_by: { type: uuidType, allowNull: false },
      reason: { type: TEXT, allowNull: false },
      points: { type: INTEGER, allowNull: false, defaultValue: 1 },
      status: {
        type: enumType(['active', 'expired', 'revoked']),
        allowNull: false,
        defaultValue: dialect === 'sqlite' ? 'active' : 'active',
      },
      expires_at: { type: DATE, allowNull: true },
      resolved_at: { type: DATE, allowNull: true },
      resolution_note: { type: TEXT, allowNull: true },
      metadata: { type: jsonType, allowNull: true },
      deleted_at: { type: DATE, allowNull: true },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addConstraint('moderation_strikes', {
      type: 'foreign key',
      fields: ['user_id'],
      name: 'moderation_strikes_user_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });
    await queryInterface.addConstraint('moderation_strikes', {
      type: 'foreign key',
      fields: ['issued_by'],
      name: 'moderation_strikes_issued_by_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'set null',
    });

    await queryInterface.createTable('admin_audit_logs', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      actor_id: { type: uuidType, allowNull: true },
      actor_role: { type: STRING, allowNull: true },
      entity_type: { type: STRING, allowNull: false },
      entity_id: { type: STRING, allowNull: true },
      action: { type: STRING, allowNull: false },
      changes: { type: jsonType, allowNull: true },
      metadata: { type: jsonType, allowNull: true },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('search_events', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      user_id: { type: uuidType, allowNull: true },
      query: { type: STRING, allowNull: false },
      results_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
      zero_results: { type: BOOLEAN, allowNull: false, defaultValue: false },
      filters: { type: jsonType, allowNull: true },
      occurred_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('search_events', ['occurred_at']);
    await queryInterface.addIndex('search_events', ['query']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('search_events', ['query']);
    await queryInterface.removeIndex('search_events', ['occurred_at']);
    await queryInterface.dropTable('search_events');
    await queryInterface.dropTable('admin_audit_logs');
    await queryInterface.dropTable('moderation_strikes');
    await queryInterface.dropTable('platform_settings');
    await queryInterface.dropTable('marketplace_configs');
    await queryInterface.removeColumn('jobs', 'hidden_at');
    await queryInterface.removeColumn('jobs', 'is_sponsored');
    await queryInterface.removeColumn('sessions', 'impersonated_at');
    await queryInterface.removeColumn('sessions', 'impersonated_by');
    await queryInterface.removeColumn('users', 'banned_reason');
    await queryInterface.removeColumn('users', 'ban_expires_at');
    await queryInterface.removeColumn('users', 'banned_at');
  },
};
