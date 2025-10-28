'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, STRING, TEXT, BOOLEAN, DATE, JSONB, JSON, ENUM } = Sequelize;
    const dialect = queryInterface.sequelize.getDialect();
    const jsonType = dialect === 'postgres' ? JSONB : JSON;
    const uuidType = dialect === 'sqlite' ? STRING : UUID;
    const enumType = (values) => (dialect === 'sqlite' ? STRING : ENUM(...values));
    const uuidDefault = Sequelize.UUIDV4;

    await queryInterface.createTable('companies', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      owner_id: { type: uuidType },
      name: { type: STRING, allowNull: false },
      slug: { type: STRING, allowNull: false, unique: true },
      description: { type: TEXT },
      website: { type: STRING },
      industry: { type: STRING },
      size: { type: enumType(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']) },
      headquarters: { type: STRING },
      verified: { type: BOOLEAN, defaultValue: false },
      verified_at: { type: DATE },
      logo_url: { type: STRING },
      banner_url: { type: STRING },
      metadata: { type: jsonType },
      analytics_snapshot: { type: jsonType },
      deleted_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('companies', ['name']);
    await queryInterface.addIndex('companies', ['verified']);

    await queryInterface.createTable('company_employees', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      company_id: { type: uuidType, allowNull: false },
      user_id: { type: uuidType, allowNull: false },
      role: { type: enumType(['member', 'admin']) },
      title: { type: STRING },
      invited_by: { type: uuidType },
      invited_at: { type: DATE },
      joined_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      removed_at: { type: DATE },
      deleted_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('company_employees', {
      type: 'unique',
      fields: ['company_id', 'user_id'],
      name: 'company_employees_company_user_key',
    });

    await queryInterface.addConstraint('company_employees', {
      type: 'foreign key',
      fields: ['company_id'],
      name: 'company_employees_company_id_fkey',
      references: { table: 'companies', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('company_employees', {
      type: 'foreign key',
      fields: ['user_id'],
      name: 'company_employees_user_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('companies', {
      type: 'foreign key',
      fields: ['owner_id'],
      name: 'companies_owner_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'set null',
    });

    await queryInterface.createTable('agencies', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      owner_id: { type: uuidType },
      name: { type: STRING, allowNull: false },
      slug: { type: STRING, allowNull: false, unique: true },
      description: { type: TEXT },
      website: { type: STRING },
      services: { type: jsonType },
      specialties: { type: jsonType },
      location: { type: STRING },
      verified: { type: BOOLEAN, defaultValue: false },
      verified_at: { type: DATE },
      logo_url: { type: STRING },
      banner_url: { type: STRING },
      metadata: { type: jsonType },
      analytics_snapshot: { type: jsonType },
      deleted_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('agencies', ['name']);
    await queryInterface.addIndex('agencies', ['verified']);

    await queryInterface.createTable('agency_members', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      agency_id: { type: uuidType, allowNull: false },
      user_id: { type: uuidType, allowNull: false },
      role: { type: enumType(['member', 'lead', 'admin']) },
      title: { type: STRING },
      invited_by: { type: uuidType },
      invited_at: { type: DATE },
      joined_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      removed_at: { type: DATE },
      deleted_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('agency_members', {
      type: 'unique',
      fields: ['agency_id', 'user_id'],
      name: 'agency_members_agency_user_key',
    });

    await queryInterface.addConstraint('agency_members', {
      type: 'foreign key',
      fields: ['agency_id'],
      name: 'agency_members_agency_id_fkey',
      references: { table: 'agencies', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('agency_members', {
      type: 'foreign key',
      fields: ['user_id'],
      name: 'agency_members_user_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('agencies', {
      type: 'foreign key',
      fields: ['owner_id'],
      name: 'agencies_owner_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'set null',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('agencies', 'agencies_owner_id_fkey');
    await queryInterface.removeConstraint('agency_members', 'agency_members_user_id_fkey');
    await queryInterface.removeConstraint('agency_members', 'agency_members_agency_id_fkey');
    await queryInterface.removeConstraint('agency_members', 'agency_members_agency_user_key');
    await queryInterface.dropTable('agency_members');
    await queryInterface.dropTable('agencies');

    await queryInterface.removeConstraint('companies', 'companies_owner_id_fkey');
    await queryInterface.removeConstraint('company_employees', 'company_employees_user_id_fkey');
    await queryInterface.removeConstraint('company_employees', 'company_employees_company_id_fkey');
    await queryInterface.removeConstraint('company_employees', 'company_employees_company_user_key');
    await queryInterface.dropTable('company_employees');
    await queryInterface.dropTable('companies');
  },
};
