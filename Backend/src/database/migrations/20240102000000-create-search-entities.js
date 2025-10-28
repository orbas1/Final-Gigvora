'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, STRING, TEXT, DATE, JSONB, JSON, ENUM, DECIMAL, INTEGER, BOOLEAN } = Sequelize;
    const dialect = queryInterface.sequelize.getDialect();
    const jsonType = dialect === 'postgres' ? JSONB : JSON;
    const enumType = (values) => (dialect === 'sqlite' ? STRING : ENUM(...values));
    const uuidType = dialect === 'sqlite' ? STRING : UUID;
    const uuidDefault = Sequelize.UUIDV4;

    await queryInterface.createTable('organizations', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      type: { type: enumType(['company', 'agency']), allowNull: false },
      name: { type: STRING, allowNull: false },
      headline: STRING,
      description: TEXT,
      location: STRING,
      website: STRING,
      size: STRING,
      industry: STRING,
      tags: TEXT,
      metadata: { type: jsonType },
      analytics_snapshot: { type: jsonType },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('organizations', ['type']);
    await queryInterface.addIndex('organizations', ['name']);

    await queryInterface.createTable('projects', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      client_id: { type: uuidType },
      organization_id: { type: uuidType },
      title: { type: STRING, allowNull: false },
      summary: STRING,
      description: TEXT,
      type: { type: enumType(['fixed', 'hourly']), allowNull: false, defaultValue: 'fixed' },
      status: {
        type: enumType(['draft', 'open', 'in_progress', 'completed', 'cancelled']),
        allowNull: false,
        defaultValue: 'draft',
      },
      budget_min: DECIMAL,
      budget_max: DECIMAL,
      currency: STRING,
      location: STRING,
      skills: TEXT,
      tags: TEXT,
      published_at: DATE,
      analytics_snapshot: { type: jsonType },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('projects', ['status']);
    await queryInterface.addIndex('projects', ['type']);
    await queryInterface.addConstraint('projects', {
      fields: ['client_id'],
      type: 'foreign key',
      name: 'projects_client_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'set null',
    });
    await queryInterface.addConstraint('projects', {
      fields: ['organization_id'],
      type: 'foreign key',
      name: 'projects_organization_id_fkey',
      references: { table: 'organizations', field: 'id' },
      onDelete: 'set null',
    });

    await queryInterface.createTable('gigs', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      seller_id: { type: uuidType, allowNull: false },
      organization_id: { type: uuidType },
      title: { type: STRING, allowNull: false },
      slug: { type: STRING, unique: true },
      description: TEXT,
      rate_amount: DECIMAL,
      rate_unit: { type: enumType(['fixed', 'hourly', 'package']), allowNull: false, defaultValue: 'fixed' },
      location: STRING,
      delivery_time_days: INTEGER,
      status: {
        type: enumType(['draft', 'active', 'paused', 'archived']),
        allowNull: false,
        defaultValue: 'draft',
      },
      skills: TEXT,
      tags: TEXT,
      analytics_snapshot: { type: jsonType },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('gigs', ['status']);
    await queryInterface.addConstraint('gigs', {
      fields: ['seller_id'],
      type: 'foreign key',
      name: 'gigs_seller_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });
    await queryInterface.addConstraint('gigs', {
      fields: ['organization_id'],
      type: 'foreign key',
      name: 'gigs_organization_id_fkey',
      references: { table: 'organizations', field: 'id' },
      onDelete: 'set null',
    });

    await queryInterface.createTable('jobs', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      company_id: { type: uuidType, allowNull: false },
      title: { type: STRING, allowNull: false },
      slug: { type: STRING, unique: true },
      description: TEXT,
      employment_type: {
        type: enumType(['full_time', 'part_time', 'contract', 'temporary', 'internship']),
        allowNull: false,
        defaultValue: 'full_time',
      },
      location: STRING,
      remote: { type: BOOLEAN, defaultValue: false },
      salary_min: DECIMAL,
      salary_max: DECIMAL,
      currency: STRING,
      skills: TEXT,
      tags: TEXT,
      status: { type: enumType(['draft', 'open', 'closed', 'archived']), allowNull: false, defaultValue: 'open' },
      posted_at: DATE,
      analytics_snapshot: { type: jsonType },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('jobs', ['status']);
    await queryInterface.addIndex('jobs', ['employment_type']);
    await queryInterface.addConstraint('jobs', {
      fields: ['company_id'],
      type: 'foreign key',
      name: 'jobs_company_id_fkey',
      references: { table: 'organizations', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.createTable('groups', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      owner_id: { type: uuidType, allowNull: false },
      name: { type: STRING, allowNull: false },
      slug: { type: STRING, unique: true },
      description: TEXT,
      privacy: { type: enumType(['public', 'private']), allowNull: false, defaultValue: 'public' },
      location: STRING,
      tags: TEXT,
      member_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
      analytics_snapshot: { type: jsonType },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('groups', ['privacy']);
    await queryInterface.addConstraint('groups', {
      fields: ['owner_id'],
      type: 'foreign key',
      name: 'groups_owner_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('groups');
    await queryInterface.dropTable('jobs');
    await queryInterface.dropTable('gigs');
    await queryInterface.dropTable('projects');
    await queryInterface.dropTable('organizations');
  },
};
