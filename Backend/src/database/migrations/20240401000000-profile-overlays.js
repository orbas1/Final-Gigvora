'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, STRING, TEXT, DATE, INTEGER, JSONB, JSON, ENUM } = Sequelize;
    const dialect = queryInterface.sequelize.getDialect();
    const jsonType = dialect === 'postgres' ? JSONB : JSON;
    const uuidType = dialect === 'sqlite' ? STRING : UUID;
    const uuidDefault = Sequelize.UUIDV4;
    const enumType = (values) => (dialect === 'sqlite' ? STRING : ENUM(...values));

    await queryInterface.createTable('freelancer_profiles', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      profile_id: { type: uuidType, allowNull: false, unique: true },
      headline: STRING,
      specialties: { type: jsonType },
      availability_status: { type: enumType(['available', 'limited', 'unavailable']), defaultValue: 'available' },
      available_hours_per_week: INTEGER,
      languages: { type: jsonType },
      rate_card: { type: jsonType },
      certifications: { type: jsonType },
      verified_at: DATE,
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addConstraint('freelancer_profiles', {
      type: 'foreign key',
      fields: ['profile_id'],
      name: 'freelancer_profiles_profile_id_fkey',
      references: { table: 'profiles', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.createTable('agency_profiles', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      org_id: { type: uuidType, allowNull: false, unique: true },
      owner_user_id: { type: uuidType },
      name: STRING,
      overview: TEXT,
      website: STRING,
      timezone: STRING,
      social_links: { type: jsonType },
      rate_card: { type: jsonType },
      metrics_snapshot: { type: jsonType },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('company_profiles', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      org_id: { type: uuidType, allowNull: false, unique: true },
      owner_user_id: { type: uuidType },
      legal_name: STRING,
      brand_name: STRING,
      overview: TEXT,
      website: STRING,
      industry: STRING,
      team_size: INTEGER,
      headquarters: STRING,
      hiring_needs: { type: jsonType },
      benefits: { type: jsonType },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('profile_views', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      profile_id: { type: uuidType, allowNull: false },
      viewer_id: { type: uuidType },
      source: STRING,
      viewed_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addConstraint('profile_views', {
      type: 'foreign key',
      fields: ['profile_id'],
      name: 'profile_views_profile_id_fkey',
      references: { table: 'profiles', field: 'id' },
      onDelete: 'cascade',
    });
    await queryInterface.addIndex('profile_views', ['profile_id', 'viewed_at'], {
      name: 'profile_views_profile_id_viewed_at_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('profile_views', 'profile_views_profile_id_viewed_at_idx');
    await queryInterface.dropTable('profile_views');
    await queryInterface.dropTable('company_profiles');
    await queryInterface.dropTable('agency_profiles');
    await queryInterface.dropTable('freelancer_profiles');
  },
};
