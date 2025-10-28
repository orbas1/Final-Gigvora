'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, STRING, TEXT, INTEGER, BOOLEAN, DATE, JSONB, JSON } = Sequelize;
    const dialect = queryInterface.sequelize.getDialect();
    const jsonType = dialect === 'postgres' ? JSONB : JSON;
    const uuidType = dialect === 'sqlite' ? STRING : UUID;
    const uuidDefault = Sequelize.UUIDV4;
    const enumType = (values) => (dialect === 'sqlite' ? STRING : Sequelize.ENUM(...values));

    await queryInterface.createTable('networking_lobbies', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      topic: { type: STRING, allowNull: false },
      description: { type: TEXT },
      duration_minutes: { type: INTEGER, allowNull: false, defaultValue: 2 },
      is_paid: { type: BOOLEAN, allowNull: false, defaultValue: false },
      status: { type: enumType(['open', 'closed', 'draft']), allowNull: false, defaultValue: 'open' },
      max_participants: { type: INTEGER, allowNull: false, defaultValue: 2 },
      created_by: { type: uuidType, allowNull: false },
      metadata: { type: jsonType },
      deleted_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('networking_lobbies', {
      type: 'foreign key',
      fields: ['created_by'],
      name: 'networking_lobbies_created_by_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.createTable('networking_sessions', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      lobby_id: { type: uuidType, allowNull: false },
      status: { type: enumType(['waiting', 'active', 'completed', 'cancelled']), allowNull: false, defaultValue: 'waiting' },
      started_at: { type: DATE },
      ended_at: { type: DATE },
      last_activity_at: { type: DATE },
      room_token: { type: STRING },
      metadata: { type: jsonType },
      deleted_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('networking_sessions', {
      type: 'foreign key',
      fields: ['lobby_id'],
      name: 'networking_sessions_lobby_id_fkey',
      references: { table: 'networking_lobbies', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.createTable('networking_session_participants', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      session_id: { type: uuidType, allowNull: false },
      user_id: { type: uuidType, allowNull: false },
      alias: { type: STRING, allowNull: false },
      joined_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      left_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      deleted_at: { type: DATE },
    });

    await queryInterface.addConstraint('networking_session_participants', {
      type: 'foreign key',
      fields: ['session_id'],
      name: 'networking_session_participants_session_id_fkey',
      references: { table: 'networking_sessions', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('networking_session_participants', {
      type: 'foreign key',
      fields: ['user_id'],
      name: 'networking_session_participants_user_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('networking_session_participants', {
      type: 'unique',
      fields: ['session_id', 'user_id'],
      name: 'networking_session_participants_session_user_unique',
    });

    await queryInterface.createTable('networking_session_feedback', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      session_id: { type: uuidType, allowNull: false },
      user_id: { type: uuidType, allowNull: false },
      stars: { type: INTEGER, allowNull: false },
      note: { type: TEXT },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      deleted_at: { type: DATE },
    });

    await queryInterface.addConstraint('networking_session_feedback', {
      type: 'foreign key',
      fields: ['session_id'],
      name: 'networking_session_feedback_session_id_fkey',
      references: { table: 'networking_sessions', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('networking_session_feedback', {
      type: 'foreign key',
      fields: ['user_id'],
      name: 'networking_session_feedback_user_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('networking_session_feedback', {
      type: 'unique',
      fields: ['session_id', 'user_id'],
      name: 'networking_session_feedback_session_user_unique',
    });

    await queryInterface.createTable('live_signals', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      session_id: { type: uuidType, allowNull: false },
      sender_id: { type: uuidType, allowNull: false },
      target_id: { type: uuidType },
      signal_type: { type: enumType(['offer', 'answer', 'ice']), allowNull: false },
      payload: { type: jsonType, allowNull: false },
      delivered_at: { type: DATE },
      expires_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      deleted_at: { type: DATE },
    });

    await queryInterface.addConstraint('live_signals', {
      type: 'foreign key',
      fields: ['session_id'],
      name: 'live_signals_session_id_fkey',
      references: { table: 'networking_sessions', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('live_signals', {
      type: 'foreign key',
      fields: ['sender_id'],
      name: 'live_signals_sender_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('live_signals', {
      type: 'foreign key',
      fields: ['target_id'],
      name: 'live_signals_target_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'set null',
    });

    await queryInterface.addIndex('networking_sessions', ['status']);
    await queryInterface.addIndex('networking_session_participants', ['session_id']);
    await queryInterface.addIndex('networking_session_participants', ['user_id']);
    await queryInterface.addIndex('networking_session_feedback', ['session_id']);
    await queryInterface.addIndex('live_signals', ['session_id']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('live_signals', ['session_id']);
    await queryInterface.removeIndex('networking_session_feedback', ['session_id']);
    await queryInterface.removeIndex('networking_session_participants', ['user_id']);
    await queryInterface.removeIndex('networking_session_participants', ['session_id']);
    await queryInterface.removeIndex('networking_sessions', ['status']);

    await queryInterface.dropTable('live_signals');
    await queryInterface.dropTable('networking_session_feedback');
    await queryInterface.dropTable('networking_session_participants');
    await queryInterface.dropTable('networking_sessions');
    await queryInterface.dropTable('networking_lobbies');
  },
};
