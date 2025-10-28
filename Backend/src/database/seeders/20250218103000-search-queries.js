'use strict';

const { v4: uuidv4 } = require('uuid');

const SAMPLE_QUERIES = [
  {
    search_type: 'people',
    query: 'product designer',
    filters: { location: 'remote', skills: ['figma', 'ux research'] },
    results_count: 42,
    analytics_snapshot: {
      total_results: 42,
      top_locations: [
        { value: 'Remote', count: 18 },
        { value: 'Berlin, Germany', count: 6 },
      ],
      top_skills: [
        { value: 'Figma', count: 27 },
        { value: 'Prototyping', count: 12 },
      ],
    },
    duration_ms: 128,
  },
  {
    search_type: 'jobs',
    query: 'full stack',
    filters: { location: 'toronto', tags: ['node.js'] },
    results_count: 9,
    analytics_snapshot: {
      total_results: 9,
      job_type_breakdown: [
        { value: 'full-time', count: 6 },
        { value: 'contract', count: 3 },
      ],
    },
    duration_ms: 212,
  },
  {
    search_type: 'companies',
    query: 'climate',
    filters: { tags: ['sustainability'] },
    results_count: 5,
    analytics_snapshot: {
      total_results: 5,
      top_industries: [
        { value: 'Climate Tech', count: 3 },
        { value: 'Energy', count: 2 },
      ],
    },
    duration_ms: 96,
  },
];

module.exports = {
  async up(queryInterface) {
    const [users] = await queryInterface.sequelize.query(
      "SELECT id FROM users WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1"
    );
    const userId = users.length ? users[0].id : null;
    const now = new Date();

    const rows = SAMPLE_QUERIES.map((entry, index) => ({
      id: uuidv4(),
      user_id: userId,
      search_type: entry.search_type,
      query: entry.query,
      filters: entry.filters,
      results_count: entry.results_count,
      analytics_snapshot: entry.analytics_snapshot,
      executed_at: new Date(now.getTime() - index * 60_000),
      duration_ms: entry.duration_ms,
      request_ip: '127.0.0.1',
      user_agent: 'seed-script',
      created_at: now,
      updated_at: now,
    }));

    await queryInterface.bulkInsert('search_queries', rows);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('search_queries', {
      user_agent: 'seed-script',
    });
  },
};
