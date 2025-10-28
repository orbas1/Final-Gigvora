'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();
    const stringType = Sequelize.STRING;
    const textType = Sequelize.TEXT;
    const dateType = Sequelize.DATE;

    const columns = [
      ['provider', stringType],
      ['provider_reference', stringType],
      ['review_notes', textType],
      ['decision_reason', stringType],
      ['reviewed_at', dateType],
      ['verified_at', dateType],
      ['rejected_at', dateType],
    ];

    // SQLite requires recreating enums; ensure the status enum includes any new states before altering columns.
    if (dialect === 'sqlite') {
      await queryInterface.sequelize.query('PRAGMA foreign_keys=OFF');
    }

    for (const [name, type] of columns) {
      // eslint-disable-next-line no-await-in-loop
      await queryInterface.addColumn('verification_requests', name, { type });
    }

    if (dialect === 'sqlite') {
      await queryInterface.sequelize.query('PRAGMA foreign_keys=ON');
    }

    await queryInterface.addIndex('verification_requests', {
      name: 'verification_requests_provider_reference_idx',
      fields: ['provider_reference'],
    });
    await queryInterface.addIndex('verification_requests', {
      name: 'verification_requests_subject_status_idx',
      fields: ['subject_type', 'subject_id', 'status'],
    });
  },

  async down(queryInterface) {
    const dialect = queryInterface.sequelize.getDialect();
    const columns = [
      'provider',
      'provider_reference',
      'review_notes',
      'decision_reason',
      'reviewed_at',
      'verified_at',
      'rejected_at',
    ];

    await queryInterface.removeIndex('verification_requests', 'verification_requests_provider_reference_idx');
    await queryInterface.removeIndex('verification_requests', 'verification_requests_subject_status_idx');

    if (dialect === 'sqlite') {
      await queryInterface.sequelize.query('PRAGMA foreign_keys=OFF');
    }

    for (const name of columns) {
      // eslint-disable-next-line no-await-in-loop
      await queryInterface.removeColumn('verification_requests', name);
    }

    if (dialect === 'sqlite') {
      await queryInterface.sequelize.query('PRAGMA foreign_keys=ON');
    }
  },
};
