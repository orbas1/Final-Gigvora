'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const {
      UUID,
      STRING,
      TEXT,
      DATE,
      BOOLEAN,
      JSON,
      JSONB,
      INTEGER,
      DECIMAL,
      ENUM,
    } = Sequelize;
    const dialect = queryInterface.sequelize.getDialect();
    const jsonType = dialect === 'postgres' ? JSONB : JSON;
    const uuidType = dialect === 'sqlite' ? STRING : UUID;
    const uuidDefault = Sequelize.UUIDV4;
    const enumType = (values) => (dialect === 'sqlite' ? STRING : ENUM(...values));

    await queryInterface.createTable('projects', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      owner_id: { type: uuidType, allowNull: false },
      title: { type: STRING, allowNull: false },
      slug: { type: STRING },
      description: { type: TEXT },
      status: {
        type: enumType(['draft', 'open', 'in_progress', 'completed', 'cancelled', 'archived']),
        allowNull: false,
        defaultValue: 'draft',
      },
      project_type: { type: enumType(['fixed', 'hourly']), allowNull: false, defaultValue: 'fixed' },
      budget_min: { type: DECIMAL(12, 2) },
      budget_max: { type: DECIMAL(12, 2) },
      budget_currency: { type: STRING, allowNull: false, defaultValue: 'USD' },
      hourly_rate: { type: DECIMAL(12, 2) },
      estimated_hours: { type: INTEGER },
      timeline: { type: STRING },
      requirements: { type: TEXT },
      attachments: { type: jsonType },
      tags_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
      invites_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
      bids_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
      milestones_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
      deliverables_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
      timelogs_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
      reviews_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
      rating_average: { type: DECIMAL(4, 2) },
      last_activity_at: { type: DATE },
      metadata: { type: jsonType },
      deleted_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('projects', {
      type: 'foreign key',
      fields: ['owner_id'],
      name: 'projects_owner_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addIndex('projects', ['owner_id']);
    await queryInterface.addIndex('projects', ['status']);
    await queryInterface.addIndex('projects', ['project_type']);

    await queryInterface.createTable('project_tags', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      project_id: { type: uuidType, allowNull: false },
      tag: { type: STRING, allowNull: false },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('project_tags', {
      type: 'foreign key',
      fields: ['project_id'],
      name: 'project_tags_project_id_fkey',
      references: { table: 'projects', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('project_tags', {
      type: 'unique',
      fields: ['project_id', 'tag'],
      name: 'project_tags_unique_project_tag',
    });

    await queryInterface.createTable('project_invites', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      project_id: { type: uuidType, allowNull: false },
      inviter_id: { type: uuidType, allowNull: false },
      invitee_id: { type: uuidType, allowNull: false },
      status: {
        type: enumType(['pending', 'accepted', 'declined', 'revoked']),
        allowNull: false,
        defaultValue: 'pending',
      },
      message: { type: TEXT },
      responded_at: { type: DATE },
      deleted_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('project_invites', {
      type: 'foreign key',
      fields: ['project_id'],
      name: 'project_invites_project_id_fkey',
      references: { table: 'projects', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('project_invites', {
      type: 'foreign key',
      fields: ['inviter_id'],
      name: 'project_invites_inviter_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('project_invites', {
      type: 'foreign key',
      fields: ['invitee_id'],
      name: 'project_invites_invitee_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('project_invites', {
      type: 'unique',
      fields: ['project_id', 'invitee_id'],
      name: 'project_invites_unique_project_invitee',
    });

    await queryInterface.createTable('project_bids', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      project_id: { type: uuidType, allowNull: false },
      bidder_id: { type: uuidType, allowNull: false },
      amount: { type: DECIMAL(12, 2) },
      currency: { type: STRING, allowNull: false, defaultValue: 'USD' },
      bid_type: { type: enumType(['fixed', 'hourly']), allowNull: false, defaultValue: 'fixed' },
      hourly_rate: { type: DECIMAL(12, 2) },
      proposed_hours: { type: INTEGER },
      cover_letter: { type: TEXT },
      attachments: { type: jsonType },
      status: {
        type: enumType(['pending', 'accepted', 'rejected', 'withdrawn']),
        allowNull: false,
        defaultValue: 'pending',
      },
      estimated_days: { type: INTEGER },
      submitted_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      decision_at: { type: DATE },
      deleted_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('project_bids', {
      type: 'foreign key',
      fields: ['project_id'],
      name: 'project_bids_project_id_fkey',
      references: { table: 'projects', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('project_bids', {
      type: 'foreign key',
      fields: ['bidder_id'],
      name: 'project_bids_bidder_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addIndex('project_bids', ['project_id']);
    await queryInterface.addIndex('project_bids', ['bidder_id']);
    await queryInterface.addIndex('project_bids', ['status']);

    await queryInterface.createTable('project_milestones', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      project_id: { type: uuidType, allowNull: false },
      title: { type: STRING, allowNull: false },
      description: { type: TEXT },
      amount: { type: DECIMAL(12, 2) },
      currency: { type: STRING, allowNull: false, defaultValue: 'USD' },
      due_date: { type: DATE },
      order_index: { type: INTEGER, allowNull: false, defaultValue: 1 },
      status: {
        type: enumType(['pending', 'in_progress', 'completed', 'released', 'cancelled']),
        allowNull: false,
        defaultValue: 'pending',
      },
      released_at: { type: DATE },
      completed_at: { type: DATE },
      deleted_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('project_milestones', {
      type: 'foreign key',
      fields: ['project_id'],
      name: 'project_milestones_project_id_fkey',
      references: { table: 'projects', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.createTable('project_deliverables', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      project_id: { type: uuidType, allowNull: false },
      milestone_id: { type: uuidType },
      submitted_by: { type: uuidType, allowNull: false },
      title: { type: STRING, allowNull: false },
      description: { type: TEXT },
      status: {
        type: enumType(['submitted', 'in_review', 'changes_requested', 'approved', 'rejected']),
        allowNull: false,
        defaultValue: 'submitted',
      },
      file_urls: { type: jsonType },
      approved_at: { type: DATE },
      rejected_at: { type: DATE },
      deleted_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('project_deliverables', {
      type: 'foreign key',
      fields: ['project_id'],
      name: 'project_deliverables_project_id_fkey',
      references: { table: 'projects', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('project_deliverables', {
      type: 'foreign key',
      fields: ['milestone_id'],
      name: 'project_deliverables_milestone_id_fkey',
      references: { table: 'project_milestones', field: 'id' },
      onDelete: 'set null',
    });

    await queryInterface.addConstraint('project_deliverables', {
      type: 'foreign key',
      fields: ['submitted_by'],
      name: 'project_deliverables_submitted_by_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.createTable('project_time_logs', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      project_id: { type: uuidType, allowNull: false },
      user_id: { type: uuidType, allowNull: false },
      started_at: { type: DATE, allowNull: false },
      ended_at: { type: DATE },
      duration_minutes: { type: INTEGER },
      notes: { type: TEXT },
      hourly_rate: { type: DECIMAL(12, 2) },
      billable_amount: { type: DECIMAL(12, 2) },
      invoice_status: {
        type: enumType(['pending', 'invoiced', 'paid', 'written_off']),
        allowNull: false,
        defaultValue: 'pending',
      },
      deleted_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('project_time_logs', {
      type: 'foreign key',
      fields: ['project_id'],
      name: 'project_time_logs_project_id_fkey',
      references: { table: 'projects', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('project_time_logs', {
      type: 'foreign key',
      fields: ['user_id'],
      name: 'project_time_logs_user_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.createTable('project_reviews', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      project_id: { type: uuidType, allowNull: false },
      reviewer_id: { type: uuidType, allowNull: false },
      reviewee_id: { type: uuidType, allowNull: false },
      rating: { type: INTEGER, allowNull: false },
      communication_rating: { type: INTEGER },
      quality_rating: { type: INTEGER },
      adherence_rating: { type: INTEGER },
      comment: { type: TEXT },
      private_notes: { type: TEXT },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('project_reviews', {
      type: 'foreign key',
      fields: ['project_id'],
      name: 'project_reviews_project_id_fkey',
      references: { table: 'projects', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('project_reviews', {
      type: 'foreign key',
      fields: ['reviewer_id'],
      name: 'project_reviews_reviewer_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('project_reviews', {
      type: 'foreign key',
      fields: ['reviewee_id'],
      name: 'project_reviews_reviewee_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('project_reviews', {
      type: 'unique',
      fields: ['project_id', 'reviewer_id'],
      name: 'project_reviews_unique_reviewer',
    });

    await queryInterface.createTable('gigs', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      seller_id: { type: uuidType, allowNull: false },
      title: { type: STRING, allowNull: false },
      slug: { type: STRING },
      description: { type: TEXT },
      category: { type: STRING },
      subcategory: { type: STRING },
      status: {
        type: enumType(['draft', 'active', 'paused', 'archived']),
        allowNull: false,
        defaultValue: 'draft',
      },
      price_min: { type: DECIMAL(12, 2) },
      price_max: { type: DECIMAL(12, 2) },
      currency: { type: STRING, allowNull: false, defaultValue: 'USD' },
      delivery_time_days: { type: INTEGER },
      tags_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
      orders_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
      reviews_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
      rating_average: { type: DECIMAL(4, 2) },
      views_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
      clicks_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
      favorites_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
      metadata: { type: jsonType },
      deleted_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('gigs', {
      type: 'foreign key',
      fields: ['seller_id'],
      name: 'gigs_seller_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addIndex('gigs', ['seller_id']);
    await queryInterface.addIndex('gigs', ['status']);

    await queryInterface.createTable('gig_tags', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      gig_id: { type: uuidType, allowNull: false },
      tag: { type: STRING, allowNull: false },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('gig_tags', {
      type: 'foreign key',
      fields: ['gig_id'],
      name: 'gig_tags_gig_id_fkey',
      references: { table: 'gigs', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('gig_tags', {
      type: 'unique',
      fields: ['gig_id', 'tag'],
      name: 'gig_tags_unique_gig_tag',
    });

    await queryInterface.createTable('gig_packages', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      gig_id: { type: uuidType, allowNull: false },
      tier: { type: enumType(['basic', 'standard', 'premium']), allowNull: false },
      name: { type: STRING, allowNull: false },
      description: { type: TEXT },
      price: { type: DECIMAL(12, 2), allowNull: false },
      currency: { type: STRING, allowNull: false, defaultValue: 'USD' },
      delivery_days: { type: INTEGER, allowNull: false },
      revisions: { type: INTEGER },
      features: { type: jsonType },
      is_active: { type: BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('gig_packages', {
      type: 'foreign key',
      fields: ['gig_id'],
      name: 'gig_packages_gig_id_fkey',
      references: { table: 'gigs', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('gig_packages', {
      type: 'unique',
      fields: ['gig_id', 'tier'],
      name: 'gig_packages_unique_tier',
    });

    await queryInterface.createTable('gig_addons', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      gig_id: { type: uuidType, allowNull: false },
      title: { type: STRING, allowNull: false },
      description: { type: TEXT },
      price: { type: DECIMAL(12, 2), allowNull: false },
      currency: { type: STRING, allowNull: false, defaultValue: 'USD' },
      delivery_days: { type: INTEGER },
      is_active: { type: BOOLEAN, allowNull: false, defaultValue: true },
      deleted_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('gig_addons', {
      type: 'foreign key',
      fields: ['gig_id'],
      name: 'gig_addons_gig_id_fkey',
      references: { table: 'gigs', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.createTable('gig_faqs', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      gig_id: { type: uuidType, allowNull: false },
      question: { type: STRING, allowNull: false },
      answer: { type: TEXT, allowNull: false },
      order_index: { type: INTEGER, allowNull: false, defaultValue: 1 },
      deleted_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('gig_faqs', {
      type: 'foreign key',
      fields: ['gig_id'],
      name: 'gig_faqs_gig_id_fkey',
      references: { table: 'gigs', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.createTable('gig_media', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      gig_id: { type: uuidType, allowNull: false },
      media_type: { type: enumType(['image', 'video', 'pdf']), allowNull: false },
      url: { type: STRING, allowNull: false },
      thumbnail_url: { type: STRING },
      order_index: { type: INTEGER, allowNull: false, defaultValue: 1 },
      metadata: { type: jsonType },
      deleted_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('gig_media', {
      type: 'foreign key',
      fields: ['gig_id'],
      name: 'gig_media_gig_id_fkey',
      references: { table: 'gigs', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.createTable('gig_orders', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      gig_id: { type: uuidType, allowNull: false },
      package_id: { type: uuidType },
      buyer_id: { type: uuidType, allowNull: false },
      seller_id: { type: uuidType, allowNull: false },
      package_tier: { type: enumType(['basic', 'standard', 'premium']), allowNull: false },
      price: { type: DECIMAL(12, 2), allowNull: false },
      currency: { type: STRING, allowNull: false, defaultValue: 'USD' },
      status: {
        type: enumType(['pending', 'requirements', 'in_progress', 'delivered', 'accepted', 'cancelled', 'refunded']),
        allowNull: false,
        defaultValue: 'pending',
      },
      requirements: { type: jsonType },
      requirements_submitted_at: { type: DATE },
      started_at: { type: DATE },
      due_at: { type: DATE },
      delivered_at: { type: DATE },
      accepted_at: { type: DATE },
      cancelled_at: { type: DATE },
      cancellation_reason: { type: TEXT },
      source: { type: STRING },
      deleted_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('gig_orders', {
      type: 'foreign key',
      fields: ['gig_id'],
      name: 'gig_orders_gig_id_fkey',
      references: { table: 'gigs', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('gig_orders', {
      type: 'foreign key',
      fields: ['package_id'],
      name: 'gig_orders_package_id_fkey',
      references: { table: 'gig_packages', field: 'id' },
      onDelete: 'set null',
    });

    await queryInterface.addConstraint('gig_orders', {
      type: 'foreign key',
      fields: ['buyer_id'],
      name: 'gig_orders_buyer_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('gig_orders', {
      type: 'foreign key',
      fields: ['seller_id'],
      name: 'gig_orders_seller_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addIndex('gig_orders', ['gig_id']);
    await queryInterface.addIndex('gig_orders', ['buyer_id']);
    await queryInterface.addIndex('gig_orders', ['seller_id']);
    await queryInterface.addIndex('gig_orders', ['status']);

    await queryInterface.createTable('gig_submissions', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      order_id: { type: uuidType, allowNull: false },
      submitted_by: { type: uuidType, allowNull: false },
      message: { type: TEXT },
      attachments: { type: jsonType },
      status: {
        type: enumType(['submitted', 'revision_requested', 'resubmitted', 'accepted']),
        allowNull: false,
        defaultValue: 'submitted',
      },
      revision_notes: { type: TEXT },
      deleted_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('gig_submissions', {
      type: 'foreign key',
      fields: ['order_id'],
      name: 'gig_submissions_order_id_fkey',
      references: { table: 'gig_orders', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('gig_submissions', {
      type: 'foreign key',
      fields: ['submitted_by'],
      name: 'gig_submissions_submitted_by_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.createTable('gig_reviews', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      order_id: { type: uuidType, allowNull: false },
      gig_id: { type: uuidType, allowNull: false },
      reviewer_id: { type: uuidType, allowNull: false },
      reviewee_id: { type: uuidType, allowNull: false },
      rating: { type: INTEGER, allowNull: false },
      communication_rating: { type: INTEGER },
      quality_rating: { type: INTEGER },
      value_rating: { type: INTEGER },
      comment: { type: TEXT },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('gig_reviews', {
      type: 'foreign key',
      fields: ['order_id'],
      name: 'gig_reviews_order_id_fkey',
      references: { table: 'gig_orders', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('gig_reviews', {
      type: 'foreign key',
      fields: ['gig_id'],
      name: 'gig_reviews_gig_id_fkey',
      references: { table: 'gigs', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('gig_reviews', {
      type: 'foreign key',
      fields: ['reviewer_id'],
      name: 'gig_reviews_reviewer_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('gig_reviews', {
      type: 'foreign key',
      fields: ['reviewee_id'],
      name: 'gig_reviews_reviewee_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('gig_reviews', {
      type: 'unique',
      fields: ['order_id', 'reviewer_id'],
      name: 'gig_reviews_unique_reviewer',
    });

    await queryInterface.createTable('gig_metrics', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      gig_id: { type: uuidType, allowNull: false },
      metric_date: { type: DATE, allowNull: false },
      views: { type: INTEGER, allowNull: false, defaultValue: 0 },
      clicks: { type: INTEGER, allowNull: false, defaultValue: 0 },
      orders: { type: INTEGER, allowNull: false, defaultValue: 0 },
      revenue: { type: DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('gig_metrics', {
      type: 'foreign key',
      fields: ['gig_id'],
      name: 'gig_metrics_gig_id_fkey',
      references: { table: 'gigs', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('gig_metrics', {
      type: 'unique',
      fields: ['gig_id', 'metric_date'],
      name: 'gig_metrics_unique_day',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('gig_metrics');
    await queryInterface.dropTable('gig_reviews');
    await queryInterface.dropTable('gig_submissions');
    await queryInterface.dropTable('gig_orders');
    await queryInterface.dropTable('gig_media');
    await queryInterface.dropTable('gig_faqs');
    await queryInterface.dropTable('gig_addons');
    await queryInterface.dropTable('gig_packages');
    await queryInterface.dropTable('gig_tags');
    await queryInterface.dropTable('gigs');
    await queryInterface.dropTable('project_reviews');
    await queryInterface.dropTable('project_time_logs');
    await queryInterface.dropTable('project_deliverables');
    await queryInterface.dropTable('project_milestones');
    await queryInterface.dropTable('project_bids');
    await queryInterface.dropTable('project_invites');
    await queryInterface.dropTable('project_tags');
    await queryInterface.dropTable('projects');
  },
};
