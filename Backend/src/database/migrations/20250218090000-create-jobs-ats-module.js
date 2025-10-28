'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, STRING, TEXT, DATE, BOOLEAN, JSONB, JSON, INTEGER, DECIMAL, ENUM } = Sequelize;
    const dialect = queryInterface.sequelize.getDialect();
    const jsonType = dialect === 'postgres' ? JSONB : JSON;
    const enumType = (values) => (dialect === 'sqlite' ? STRING : ENUM(...values));
    const uuidType = dialect === 'sqlite' ? STRING : UUID;
    const uuidDefault = Sequelize.UUIDV4;

    await queryInterface.createTable('jobs', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      posted_by: { type: uuidType, allowNull: false },
      company_id: { type: uuidType },
      title: { type: STRING, allowNull: false },
      slug: { type: STRING },
      description: { type: TEXT },
      location: { type: STRING },
      job_type: { type: STRING },
      salary_min: { type: DECIMAL(12, 2) },
      salary_max: { type: DECIMAL(12, 2) },
      salary_currency: { type: STRING, defaultValue: 'USD' },
      status: { type: enumType(['draft', 'open', 'paused', 'closed', 'archived']), allowNull: false, defaultValue: 'draft' },
      published_at: { type: DATE },
      closes_at: { type: DATE },
      views_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
      applications_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
      hires_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
      metadata: { type: jsonType },
      deleted_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('jobs', {
      type: 'foreign key',
      fields: ['posted_by'],
      name: 'jobs_posted_by_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('jobs', {
      type: 'foreign key',
      fields: ['company_id'],
      name: 'jobs_company_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'set null',
    });

    await queryInterface.createTable('job_tags', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      job_id: { type: uuidType, allowNull: false },
      tag: { type: STRING, allowNull: false },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addConstraint('job_tags', {
      type: 'foreign key',
      fields: ['job_id'],
      name: 'job_tags_job_id_fkey',
      references: { table: 'jobs', field: 'id' },
      onDelete: 'cascade',
    });
    await queryInterface.addConstraint('job_tags', {
      type: 'unique',
      fields: ['job_id', 'tag'],
      name: 'job_tags_unique_job_tag',
    });

    await queryInterface.createTable('job_stages', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      job_id: { type: uuidType, allowNull: false },
      name: { type: STRING, allowNull: false },
      slug: { type: STRING },
      order_index: { type: INTEGER, allowNull: false },
      is_default: { type: BOOLEAN, allowNull: false, defaultValue: false },
      auto_advance_days: { type: INTEGER },
      deleted_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addConstraint('job_stages', {
      type: 'foreign key',
      fields: ['job_id'],
      name: 'job_stages_job_id_fkey',
      references: { table: 'jobs', field: 'id' },
      onDelete: 'cascade',
    });
    await queryInterface.addConstraint('job_stages', {
      type: 'unique',
      fields: ['job_id', 'order_index'],
      name: 'job_stages_unique_order',
    });

    await queryInterface.createTable('job_applications', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      job_id: { type: uuidType, allowNull: false },
      stage_id: { type: uuidType },
      candidate_id: { type: uuidType },
      resume_url: { type: STRING },
      parsed_fields: { type: jsonType },
      status: { type: enumType(['applied', 'screening', 'interviewing', 'offered', 'hired', 'rejected', 'withdrawn']), allowNull: false, defaultValue: 'applied' },
      notes: { type: TEXT },
      rating: { type: INTEGER },
      tags_snapshot: { type: jsonType },
      email: { type: STRING },
      phone: { type: STRING },
      withdrew_at: { type: DATE },
      hired_at: { type: DATE },
      deleted_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addConstraint('job_applications', {
      type: 'foreign key',
      fields: ['job_id'],
      name: 'job_applications_job_id_fkey',
      references: { table: 'jobs', field: 'id' },
      onDelete: 'cascade',
    });
    await queryInterface.addConstraint('job_applications', {
      type: 'foreign key',
      fields: ['stage_id'],
      name: 'job_applications_stage_id_fkey',
      references: { table: 'job_stages', field: 'id' },
      onDelete: 'set null',
    });
    await queryInterface.addConstraint('job_applications', {
      type: 'foreign key',
      fields: ['candidate_id'],
      name: 'job_applications_candidate_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'set null',
    });

    await queryInterface.createTable('application_tags', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      application_id: { type: uuidType, allowNull: false },
      tag: { type: STRING, allowNull: false },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addConstraint('application_tags', {
      type: 'foreign key',
      fields: ['application_id'],
      name: 'application_tags_application_id_fkey',
      references: { table: 'job_applications', field: 'id' },
      onDelete: 'cascade',
    });
    await queryInterface.addConstraint('application_tags', {
      type: 'unique',
      fields: ['application_id', 'tag'],
      name: 'application_tags_unique',
    });

    await queryInterface.createTable('scorecards', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      application_id: { type: uuidType, allowNull: false },
      reviewer_id: { type: uuidType, allowNull: false },
      overall_rating: { type: INTEGER },
      recommendation: { type: enumType(['strong_hire', 'hire', 'no_hire', 'strong_no_hire', 'undecided']) },
      competencies: { type: jsonType },
      summary: { type: TEXT },
      submitted_at: { type: DATE },
      deleted_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addConstraint('scorecards', {
      type: 'foreign key',
      fields: ['application_id'],
      name: 'scorecards_application_id_fkey',
      references: { table: 'job_applications', field: 'id' },
      onDelete: 'cascade',
    });
    await queryInterface.addConstraint('scorecards', {
      type: 'foreign key',
      fields: ['reviewer_id'],
      name: 'scorecards_reviewer_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });
    await queryInterface.addConstraint('scorecards', {
      type: 'unique',
      fields: ['application_id', 'reviewer_id'],
      name: 'scorecards_unique_reviewer',
    });

    await queryInterface.createTable('interviews', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      job_id: { type: uuidType, allowNull: false },
      application_id: { type: uuidType, allowNull: false },
      scheduled_at: { type: DATE, allowNull: false },
      duration_minutes: { type: INTEGER },
      meeting_url: { type: STRING },
      location: { type: STRING },
      status: { type: enumType(['scheduled', 'completed', 'cancelled']), allowNull: false, defaultValue: 'scheduled' },
      panel: { type: jsonType },
      notes: { type: TEXT },
      recording_url: { type: STRING },
      deleted_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addConstraint('interviews', {
      type: 'foreign key',
      fields: ['job_id'],
      name: 'interviews_job_id_fkey',
      references: { table: 'jobs', field: 'id' },
      onDelete: 'cascade',
    });
    await queryInterface.addConstraint('interviews', {
      type: 'foreign key',
      fields: ['application_id'],
      name: 'interviews_application_id_fkey',
      references: { table: 'job_applications', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.createTable('interview_feedback', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      interview_id: { type: uuidType, allowNull: false },
      reviewer_id: { type: uuidType, allowNull: false },
      rating: { type: INTEGER },
      highlights: { type: TEXT },
      concerns: { type: TEXT },
      recommendation: { type: enumType(['strong_hire', 'hire', 'no_hire', 'strong_no_hire', 'undecided']) },
      submitted_at: { type: DATE },
      deleted_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addConstraint('interview_feedback', {
      type: 'foreign key',
      fields: ['interview_id'],
      name: 'interview_feedback_interview_id_fkey',
      references: { table: 'interviews', field: 'id' },
      onDelete: 'cascade',
    });
    await queryInterface.addConstraint('interview_feedback', {
      type: 'foreign key',
      fields: ['reviewer_id'],
      name: 'interview_feedback_reviewer_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });
    await queryInterface.addConstraint('interview_feedback', {
      type: 'unique',
      fields: ['interview_id', 'reviewer_id'],
      name: 'interview_feedback_unique_reviewer',
    });

    await queryInterface.createTable('job_metrics', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      job_id: { type: uuidType, allowNull: false },
      metric_date: { type: DATE, allowNull: false },
      views_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
      applications_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addConstraint('job_metrics', {
      type: 'foreign key',
      fields: ['job_id'],
      name: 'job_metrics_job_id_fkey',
      references: { table: 'jobs', field: 'id' },
      onDelete: 'cascade',
    });
    await queryInterface.addConstraint('job_metrics', {
      type: 'unique',
      fields: ['job_id', 'metric_date'],
      name: 'job_metrics_unique_date',
    });

    await queryInterface.addIndex('jobs', ['company_id']);
    await queryInterface.addIndex('jobs', ['posted_by']);
    await queryInterface.addIndex('jobs', ['status']);
    await queryInterface.addIndex('jobs', ['job_type']);
    await queryInterface.addIndex('jobs', ['location']);
    await queryInterface.addIndex('job_applications', ['job_id']);
    await queryInterface.addIndex('job_applications', ['candidate_id']);
    await queryInterface.addIndex('job_applications', ['status']);
    await queryInterface.addIndex('interviews', ['job_id']);
    await queryInterface.addIndex('interviews', ['application_id']);
    await queryInterface.addIndex('interviews', ['scheduled_at']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('interviews', ['scheduled_at']);
    await queryInterface.removeIndex('interviews', ['application_id']);
    await queryInterface.removeIndex('interviews', ['job_id']);
    await queryInterface.removeIndex('job_applications', ['status']);
    await queryInterface.removeIndex('job_applications', ['candidate_id']);
    await queryInterface.removeIndex('job_applications', ['job_id']);
    await queryInterface.removeIndex('jobs', ['location']);
    await queryInterface.removeIndex('jobs', ['job_type']);
    await queryInterface.removeIndex('jobs', ['status']);
    await queryInterface.removeIndex('jobs', ['posted_by']);
    await queryInterface.removeIndex('jobs', ['company_id']);
    await queryInterface.dropTable('job_metrics');
    await queryInterface.dropTable('interview_feedback');
    await queryInterface.dropTable('interviews');
    await queryInterface.dropTable('scorecards');
    await queryInterface.dropTable('application_tags');
    await queryInterface.dropTable('job_applications');
    await queryInterface.dropTable('job_stages');
    await queryInterface.dropTable('job_tags');
    await queryInterface.dropTable('jobs');
  },
};
