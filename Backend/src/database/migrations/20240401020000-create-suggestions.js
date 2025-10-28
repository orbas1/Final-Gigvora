'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, STRING, TEXT, DATE, BOOLEAN, JSONB, JSON, DECIMAL } = Sequelize;
    const dialect = queryInterface.sequelize.getDialect();
    const jsonType = dialect === 'postgres' ? JSONB : JSON;
    const enumType = (values) => (dialect === 'sqlite' ? STRING : Sequelize.ENUM(...values));
    const uuidType = dialect === 'sqlite' ? STRING : UUID;
    const uuidDefault = Sequelize.UUIDV4;

    await queryInterface.createTable('discover_entities', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      type: {
        type: enumType(['feed', 'people', 'groups', 'companies', 'projects', 'gigs', 'jobs']),
        allowNull: false,
      },
      slug: { type: STRING, allowNull: false, unique: true },
      title: { type: STRING, allowNull: false },
      subtitle: STRING,
      description: TEXT,
      image_url: STRING,
      metadata: { type: jsonType },
      tags: { type: jsonType },
      metrics: { type: jsonType },
      relevance_score: { type: DECIMAL(10, 4), defaultValue: 0 },
      search_terms: TEXT,
      starts_at: DATE,
      ends_at: DATE,
      status: { type: STRING, allowNull: false, defaultValue: 'active' },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('suggestions', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      user_id: { type: uuidType, allowNull: true },
      suggestion_for: {
        type: enumType(['feed', 'people', 'groups', 'companies', 'projects', 'gigs', 'jobs']),
        allowNull: false,
      },
      entity_id: { type: uuidType, allowNull: true },
      entity_type: { type: STRING },
      entity_ref_id: { type: uuidType, allowNull: true },
      entity_ref_type: { type: STRING },
      score: { type: DECIMAL(10, 4), defaultValue: 0 },
      reason: STRING,
      metadata: { type: jsonType },
      search_terms: TEXT,
      delivered_at: DATE,
      expires_at: DATE,
      pinned: { type: BOOLEAN, defaultValue: false },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('suggestions', {
      type: 'foreign key',
      fields: ['user_id'],
      name: 'suggestions_user_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('suggestions', {
      type: 'foreign key',
      fields: ['entity_id'],
      name: 'suggestions_entity_id_fkey',
      references: { table: 'discover_entities', field: 'id' },
      onDelete: 'set null',
    });

    await queryInterface.addIndex('suggestions', ['user_id', 'suggestion_for']);
    await queryInterface.addIndex('suggestions', ['suggestion_for', 'entity_ref_type']);
    if (dialect === 'mysql') {
      await queryInterface.addIndex('suggestions', ['search_terms'], {
        name: 'suggestions_search_terms_fulltext',
        type: 'FULLTEXT',
      });
    } else {
      await queryInterface.addIndex('suggestions', ['search_terms']);
    }
    await queryInterface.addIndex('suggestions', ['score']);
    await queryInterface.addConstraint('suggestions', {
      type: 'unique',
      name: 'suggestions_unique_user_entity',
      fields: ['user_id', 'suggestion_for', 'entity_ref_type', 'entity_ref_id'],
    });

    await queryInterface.createTable('suggestion_events', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      suggestion_id: { type: uuidType, allowNull: false },
      user_id: { type: uuidType, allowNull: false },
      event_type: {
        type: enumType(['impression', 'click', 'dismiss', 'save']),
        allowNull: false,
      },
      occurred_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      context: { type: jsonType },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('suggestion_events', {
      type: 'foreign key',
      fields: ['suggestion_id'],
      name: 'suggestion_events_suggestion_id_fkey',
      references: { table: 'suggestions', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('suggestion_events', {
      type: 'foreign key',
      fields: ['user_id'],
      name: 'suggestion_events_user_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addIndex('suggestion_events', ['suggestion_id', 'event_type']);
    await queryInterface.addIndex('suggestion_events', ['user_id', 'event_type']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('suggestion_events');
    await queryInterface.dropTable('suggestions');
    await queryInterface.dropTable('discover_entities');
  },
};
