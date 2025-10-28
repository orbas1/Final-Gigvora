'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, STRING, TEXT, DATE, BOOLEAN, JSONB, JSON, ENUM } = Sequelize;
    const dialect = queryInterface.sequelize.getDialect();
    const uuidType = dialect === 'sqlite' ? STRING : UUID;
    const uuidDefault = Sequelize.UUIDV4;
    const jsonType = dialect === 'postgres' ? JSONB : JSON;
    const enumType = (values) => (dialect === 'sqlite' ? STRING : ENUM(...values));

    await queryInterface.createTable('calendar_events', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      owner_id: { type: uuidType, allowNull: false },
      org_id: { type: uuidType, allowNull: true },
      title: { type: STRING, allowNull: false },
      description: { type: TEXT, allowNull: true },
      location: { type: STRING, allowNull: true },
      start_at: { type: DATE, allowNull: false },
      end_at: { type: DATE, allowNull: false },
      all_day: { type: BOOLEAN, allowNull: false, defaultValue: false },
      visibility: {
        type: enumType(['private', 'team', 'public']),
        allowNull: false,
        defaultValue: 'private',
      },
      scope: {
        type: enumType(['user', 'org']),
        allowNull: false,
        defaultValue: 'user',
      },
      status: {
        type: enumType(['confirmed', 'tentative', 'cancelled']),
        allowNull: false,
        defaultValue: 'confirmed',
      },
      source: { type: STRING, allowNull: true },
      metadata: { type: jsonType, allowNull: true },
      deleted_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('calendar_events', {
      type: 'foreign key',
      fields: ['owner_id'],
      name: 'calendar_events_owner_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addIndex('calendar_events', ['owner_id']);
    await queryInterface.addIndex('calendar_events', ['org_id']);
    await queryInterface.addIndex('calendar_events', ['start_at']);

    await queryInterface.createTable('calendar_event_participants', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      event_id: { type: uuidType, allowNull: false },
      user_id: { type: uuidType, allowNull: true },
      email: { type: STRING, allowNull: true },
      name: { type: STRING, allowNull: true },
      role: {
        type: enumType(['organizer', 'attendee']),
        allowNull: false,
        defaultValue: 'attendee',
      },
      status: {
        type: enumType(['needs_action', 'accepted', 'declined', 'tentative']),
        allowNull: false,
        defaultValue: 'needs_action',
      },
      responded_at: { type: DATE, allowNull: true },
      metadata: { type: jsonType, allowNull: true },
      deleted_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('calendar_event_participants', {
      type: 'foreign key',
      fields: ['event_id'],
      name: 'calendar_event_participants_event_id_fkey',
      references: { table: 'calendar_events', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('calendar_event_participants', {
      type: 'foreign key',
      fields: ['user_id'],
      name: 'calendar_event_participants_user_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'set null',
    });

    await queryInterface.addIndex('calendar_event_participants', ['event_id']);
    await queryInterface.addIndex('calendar_event_participants', ['user_id']);

    await queryInterface.createTable('calendar_integrations', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      user_id: { type: uuidType, allowNull: false },
      provider: { type: STRING, allowNull: false },
      external_account_id: { type: STRING, allowNull: true },
      access_token: { type: TEXT, allowNull: true },
      refresh_token: { type: TEXT, allowNull: true },
      expires_at: { type: DATE, allowNull: true },
      scope: { type: STRING, allowNull: true },
      settings: { type: jsonType, allowNull: true },
      status: {
        type: enumType(['connected', 'revoked', 'error']),
        allowNull: false,
        defaultValue: 'connected',
      },
      last_synced_at: { type: DATE, allowNull: true },
      revoked_at: { type: DATE, allowNull: true },
      deleted_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('calendar_integrations', {
      type: 'foreign key',
      fields: ['user_id'],
      name: 'calendar_integrations_user_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addIndex('calendar_integrations', ['user_id']);
    await queryInterface.addConstraint('calendar_integrations', {
      type: 'unique',
      fields: ['user_id', 'provider'],
      name: 'calendar_integrations_user_provider_key',
    });

    await queryInterface.createTable('calendar_ics_tokens', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      user_id: { type: uuidType, allowNull: false },
      token: { type: STRING(128), allowNull: false, unique: true },
      description: { type: STRING, allowNull: true },
      last_used_at: { type: DATE, allowNull: true },
      revoked_at: { type: DATE, allowNull: true },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('calendar_ics_tokens', {
      type: 'foreign key',
      fields: ['user_id'],
      name: 'calendar_ics_tokens_user_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addIndex('calendar_ics_tokens', ['user_id']);
    await queryInterface.addIndex('calendar_ics_tokens', ['token']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('calendar_ics_tokens');
    await queryInterface.dropTable('calendar_integrations');
    await queryInterface.dropTable('calendar_event_participants');
    await queryInterface.dropTable('calendar_events');
  },
};
