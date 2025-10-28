'use strict';

const SEARCH_TYPES = ['people', 'freelancers', 'agencies', 'companies', 'projects', 'gigs', 'jobs', 'groups'];

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, STRING, DATE, INTEGER, JSONB, JSON, TEXT } = Sequelize;
    const dialect = queryInterface.sequelize.getDialect();
    const jsonType = dialect === 'postgres' ? JSONB : JSON;
    const enumType = (values) => (dialect === 'sqlite' ? STRING : Sequelize.ENUM(...values));
    const uuidType = dialect === 'sqlite' ? STRING : UUID;
    const uuidDefault = Sequelize.UUIDV4;

    await queryInterface.createTable('search_queries', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      user_id: { type: uuidType, allowNull: true },
      search_type: { type: enumType(SEARCH_TYPES), allowNull: false },
      query: { type: STRING },
      filters: { type: jsonType },
      results_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
      analytics_snapshot: { type: jsonType },
      executed_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      duration_ms: { type: INTEGER },
      request_ip: { type: STRING },
      user_agent: { type: TEXT },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      deleted_at: { type: DATE },
    });

    await queryInterface.addConstraint('search_queries', {
      type: 'foreign key',
      fields: ['user_id'],
      name: 'search_queries_user_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'set null',
    });

    await queryInterface.addIndex('search_queries', ['search_type', 'executed_at']);
    await queryInterface.addIndex('search_queries', ['user_id', 'executed_at']);
    await queryInterface.addIndex('search_queries', ['search_type', 'query']);

    if (dialect === 'mysql') {
      await queryInterface.addIndex('search_queries', ['query'], {
        name: 'search_queries_query_fulltext',
        type: 'FULLTEXT',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('search_queries');
  },
};
