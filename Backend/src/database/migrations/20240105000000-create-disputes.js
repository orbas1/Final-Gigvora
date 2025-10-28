'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, STRING, TEXT, DATE, ENUM, JSONB, JSON, DECIMAL } = Sequelize;
    const dialect = queryInterface.sequelize.getDialect();
    const enumType = (values) => (dialect === 'sqlite' ? STRING : ENUM(...values));
    const uuidType = dialect === 'sqlite' ? STRING : UUID;
    const jsonType = dialect === 'postgres' ? JSONB : JSON;
    const uuidDefault = Sequelize.UUIDV4;

    await queryInterface.createTable('disputes', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      entity_type: { type: enumType(['project', 'order']), allowNull: false },
      entity_ref: { type: STRING, allowNull: false },
      status: {
        type: enumType(['open', 'under_review', 'action_required', 'resolved', 'closed', 'cancelled']),
        allowNull: false,
        defaultValue: 'open',
      },
      reason: { type: STRING, allowNull: false },
      details: { type: TEXT },
      created_by: { type: uuidType },
      assigned_to: { type: uuidType },
      resolution_summary: { type: TEXT },
      metadata: { type: jsonType },
      closed_at: { type: DATE },
      deleted_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('disputes', {
      type: 'foreign key',
      fields: ['created_by'],
      name: 'disputes_created_by_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'set null',
      onUpdate: 'cascade',
    });

    await queryInterface.addConstraint('disputes', {
      type: 'foreign key',
      fields: ['assigned_to'],
      name: 'disputes_assigned_to_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'set null',
      onUpdate: 'cascade',
    });

    await queryInterface.createTable('dispute_messages', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      dispute_id: { type: uuidType, allowNull: false },
      user_id: { type: uuidType },
      body: { type: TEXT, allowNull: false },
      attachments: { type: jsonType },
      visibility: { type: enumType(['party', 'internal']), defaultValue: 'party' },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      deleted_at: { type: DATE },
    });

    await queryInterface.addConstraint('dispute_messages', {
      type: 'foreign key',
      fields: ['dispute_id'],
      name: 'dispute_messages_dispute_id_fkey',
      references: { table: 'disputes', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('dispute_messages', {
      type: 'foreign key',
      fields: ['user_id'],
      name: 'dispute_messages_user_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'set null',
    });

    await queryInterface.createTable('dispute_evidence', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      dispute_id: { type: uuidType, allowNull: false },
      user_id: { type: uuidType },
      kind: { type: STRING, allowNull: false },
      title: { type: STRING },
      description: { type: TEXT },
      file_id: { type: uuidType },
      metadata: { type: jsonType },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      deleted_at: { type: DATE },
    });

    await queryInterface.addConstraint('dispute_evidence', {
      type: 'foreign key',
      fields: ['dispute_id'],
      name: 'dispute_evidence_dispute_id_fkey',
      references: { table: 'disputes', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('dispute_evidence', {
      type: 'foreign key',
      fields: ['user_id'],
      name: 'dispute_evidence_user_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'set null',
    });

    await queryInterface.createTable('dispute_settlements', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      dispute_id: { type: uuidType, allowNull: false },
      proposed_by: { type: uuidType },
      type: { type: enumType(['partial', 'full']), allowNull: false },
      amount: { type: DECIMAL(15, 2) },
      currency: { type: STRING(3) },
      terms: { type: TEXT },
      status: { type: enumType(['proposed', 'accepted', 'declined', 'expired']), defaultValue: 'proposed' },
      responded_at: { type: DATE },
      metadata: { type: jsonType },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('dispute_settlements', {
      type: 'foreign key',
      fields: ['dispute_id'],
      name: 'dispute_settlements_dispute_id_fkey',
      references: { table: 'disputes', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('dispute_settlements', {
      type: 'foreign key',
      fields: ['proposed_by'],
      name: 'dispute_settlements_proposed_by_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'set null',
    });

    await queryInterface.createTable('dispute_decisions', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      dispute_id: { type: uuidType, allowNull: false },
      decided_by: { type: uuidType },
      outcome: {
        type: enumType(['resolved_for_claimant', 'resolved_for_respondent', 'split', 'escalated']),
        allowNull: false,
      },
      award_amount: { type: DECIMAL(15, 2) },
      award_currency: { type: STRING(3) },
      summary: { type: TEXT },
      metadata: { type: jsonType },
      decided_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('dispute_decisions', {
      type: 'foreign key',
      fields: ['dispute_id'],
      name: 'dispute_decisions_dispute_id_fkey',
      references: { table: 'disputes', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('dispute_decisions', {
      type: 'foreign key',
      fields: ['decided_by'],
      name: 'dispute_decisions_decided_by_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'set null',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('dispute_decisions');
    await queryInterface.dropTable('dispute_settlements');
    await queryInterface.dropTable('dispute_evidence');
    await queryInterface.dropTable('dispute_messages');
    await queryInterface.dropTable('disputes');
  },
};
