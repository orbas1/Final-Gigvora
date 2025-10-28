'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, STRING, TEXT, DATE, JSONB, JSON, INTEGER, BOOLEAN } = Sequelize;
    const dialect = queryInterface.sequelize.getDialect();
    const jsonType = dialect === 'postgres' ? JSONB : JSON;
    const uuidType = dialect === 'sqlite' ? STRING : UUID;
    const uuidDefault = Sequelize.UUIDV4;

    await queryInterface.createTable('conversations', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      title: { type: STRING },
      type: { type: STRING, allowNull: false, defaultValue: 'direct' },
      created_by: { type: uuidType, allowNull: false },
      last_message_at: { type: DATE },
      metadata: { type: jsonType },
      deleted_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('conversations', {
      type: 'foreign key',
      fields: ['created_by'],
      name: 'conversations_created_by_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'cascade',
    });

    await queryInterface.createTable('conversation_participants', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      conversation_id: { type: uuidType, allowNull: false },
      user_id: { type: uuidType, allowNull: false },
      role: { type: STRING, allowNull: false, defaultValue: 'member' },
      pinned: { type: BOOLEAN, allowNull: false, defaultValue: false },
      archived: { type: BOOLEAN, allowNull: false, defaultValue: false },
      last_read_at: { type: DATE },
      last_read_message_id: { type: uuidType },
      unread_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
      joined_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      left_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('conversation_participants', {
      type: 'unique',
      fields: ['conversation_id', 'user_id'],
      name: 'conversation_participants_unique_member',
    });

    await queryInterface.addConstraint('conversation_participants', {
      type: 'foreign key',
      fields: ['conversation_id'],
      name: 'conversation_participants_conversation_id_fkey',
      references: { table: 'conversations', field: 'id' },
      onDelete: 'cascade',
      onUpdate: 'cascade',
    });

    await queryInterface.addConstraint('conversation_participants', {
      type: 'foreign key',
      fields: ['user_id'],
      name: 'conversation_participants_user_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
      onUpdate: 'cascade',
    });

    await queryInterface.createTable('messages', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      conversation_id: { type: uuidType, allowNull: false },
      sender_id: { type: uuidType, allowNull: false },
      text: { type: TEXT },
      attachments: { type: jsonType, allowNull: false, defaultValue: dialect === 'sqlite' ? '[]' : [] },
      metadata: { type: jsonType },
      edited_at: { type: DATE },
      deleted_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('messages', {
      type: 'foreign key',
      fields: ['conversation_id'],
      name: 'messages_conversation_id_fkey',
      references: { table: 'conversations', field: 'id' },
      onDelete: 'cascade',
      onUpdate: 'cascade',
    });

    await queryInterface.addConstraint('messages', {
      type: 'foreign key',
      fields: ['sender_id'],
      name: 'messages_sender_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
      onUpdate: 'cascade',
    });

    await queryInterface.createTable('message_reads', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      message_id: { type: uuidType, allowNull: false },
      user_id: { type: uuidType, allowNull: false },
      read_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('message_reads', {
      type: 'unique',
      fields: ['message_id', 'user_id'],
      name: 'message_reads_unique_user',
    });

    await queryInterface.addConstraint('message_reads', {
      type: 'foreign key',
      fields: ['message_id'],
      name: 'message_reads_message_id_fkey',
      references: { table: 'messages', field: 'id' },
      onDelete: 'cascade',
      onUpdate: 'cascade',
    });

    await queryInterface.addConstraint('message_reads', {
      type: 'foreign key',
      fields: ['user_id'],
      name: 'message_reads_user_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
      onUpdate: 'cascade',
    });

    await queryInterface.addIndex('conversations', ['updated_at']);
    await queryInterface.addIndex('conversations', ['last_message_at']);
    await queryInterface.addIndex('messages', ['conversation_id', 'created_at']);
    await queryInterface.addIndex('conversation_participants', ['user_id']);
    await queryInterface.addIndex('conversation_participants', ['conversation_id']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('conversation_participants', ['conversation_id']);
    await queryInterface.removeIndex('conversation_participants', ['user_id']);
    await queryInterface.removeIndex('messages', ['conversation_id', 'created_at']);
    await queryInterface.removeIndex('conversations', ['last_message_at']);
    await queryInterface.removeIndex('conversations', ['updated_at']);
    await queryInterface.dropTable('message_reads');
    await queryInterface.dropTable('messages');
    await queryInterface.dropTable('conversation_participants');
    await queryInterface.dropTable('conversations');
  },
};
