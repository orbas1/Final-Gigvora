'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, STRING, TEXT, DATE, ENUM, DECIMAL, JSONB, JSON, INTEGER, BOOLEAN } = Sequelize;
    const dialect = queryInterface.sequelize.getDialect();
    const jsonType = dialect === 'postgres' ? JSONB : JSON;
    const enumType = (values) => (dialect === 'sqlite' ? STRING : ENUM(...values));
    const uuidType = dialect === 'sqlite' ? STRING : UUID;
    const uuidDefault = Sequelize.UUIDV4;

    await queryInterface.createTable('projects', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      owner_id: { type: uuidType, allowNull: false },
      title: { type: STRING, allowNull: false },
      description: { type: TEXT },
      type: { type: enumType(['fixed', 'hourly']), allowNull: false, defaultValue: 'fixed' },
      status: {
        type: enumType(['draft', 'open', 'in_progress', 'completed', 'cancelled', 'archived']),
        allowNull: false,
        defaultValue: 'draft',
      },
      budget_min: DECIMAL,
      budget_max: DECIMAL,
      currency: { type: STRING, defaultValue: 'USD' },
      location: STRING,
      published_at: DATE,
      due_date: DATE,
      metadata: { type: jsonType },
      analytics_snapshot: { type: jsonType },
      awarded_bid_id: { type: uuidType },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('project_tags', {
      project_id: { type: uuidType, allowNull: false },
      tag_id: { type: uuidType, allowNull: false },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addConstraint('project_tags', {
      type: 'primary key',
      fields: ['project_id', 'tag_id'],
      name: 'project_tags_pk',
    });

    await queryInterface.createTable('project_invites', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      project_id: { type: uuidType, allowNull: false },
      inviter_id: { type: uuidType, allowNull: false },
      freelancer_id: { type: uuidType, allowNull: false },
      message: TEXT,
      status: {
        type: enumType(['pending', 'accepted', 'declined', 'expired']),
        allowNull: false,
        defaultValue: 'pending',
      },
      responded_at: DATE,
      metadata: { type: jsonType },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('project_bids', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      project_id: { type: uuidType, allowNull: false },
      bidder_id: { type: uuidType, allowNull: false },
      amount: DECIMAL,
      currency: { type: STRING, defaultValue: 'USD' },
      timeline: STRING,
      proposal: TEXT,
      attachments: { type: jsonType },
      metadata: { type: jsonType },
      status: {
        type: enumType(['pending', 'accepted', 'rejected', 'withdrawn']),
        allowNull: false,
        defaultValue: 'pending',
      },
      submitted_at: { type: DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      responded_at: DATE,
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('project_milestones', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      project_id: { type: uuidType, allowNull: false },
      title: { type: STRING, allowNull: false },
      description: TEXT,
      amount: DECIMAL,
      currency: { type: STRING, defaultValue: 'USD' },
      due_date: DATE,
      status: {
        type: enumType(['pending', 'funded', 'released', 'cancelled']),
        allowNull: false,
        defaultValue: 'pending',
      },
      sequence: INTEGER,
      released_at: DATE,
      metadata: { type: jsonType },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('project_deliverables', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      project_id: { type: uuidType, allowNull: false },
      milestone_id: { type: uuidType },
      submitter_id: { type: uuidType, allowNull: false },
      reviewer_id: { type: uuidType },
      title: { type: STRING, allowNull: false },
      description: TEXT,
      attachments: { type: jsonType },
      status: {
        type: enumType(['submitted', 'accepted', 'revision_requested']),
        allowNull: false,
        defaultValue: 'submitted',
      },
      submitted_at: { type: DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      reviewed_at: DATE,
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('project_time_logs', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      project_id: { type: uuidType, allowNull: false },
      user_id: { type: uuidType, allowNull: false },
      started_at: { type: DATE, allowNull: false },
      ended_at: DATE,
      duration_minutes: { type: INTEGER, allowNull: false },
      notes: TEXT,
      status: {
        type: enumType(['pending', 'approved', 'rejected']),
        allowNull: false,
        defaultValue: 'pending',
      },
      approved_by: { type: uuidType },
      approved_at: DATE,
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('project_reviews', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      project_id: { type: uuidType, allowNull: false },
      reviewer_id: { type: uuidType, allowNull: false },
      reviewee_id: { type: uuidType, allowNull: false },
      rating: { type: INTEGER, allowNull: false },
      comment: TEXT,
      private_note: TEXT,
      metadata: { type: jsonType },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('gigs', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      seller_id: { type: uuidType, allowNull: false },
      title: { type: STRING, allowNull: false },
      slug: { type: STRING, unique: true },
      description: TEXT,
      category: STRING,
      subcategory: STRING,
      status: { type: enumType(['draft', 'active', 'paused']), allowNull: false, defaultValue: 'draft' },
      price_min: DECIMAL,
      price_max: DECIMAL,
      currency: { type: STRING, defaultValue: 'USD' },
      metadata: { type: jsonType },
      analytics_snapshot: { type: jsonType },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('gig_tags', {
      gig_id: { type: uuidType, allowNull: false },
      tag_id: { type: uuidType, allowNull: false },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addConstraint('gig_tags', {
      type: 'primary key',
      fields: ['gig_id', 'tag_id'],
      name: 'gig_tags_pk',
    });

    await queryInterface.createTable('gig_packages', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      gig_id: { type: uuidType, allowNull: false },
      tier: { type: enumType(['basic', 'standard', 'premium']), allowNull: false },
      name: { type: STRING, allowNull: false },
      description: TEXT,
      price: { type: DECIMAL, allowNull: false },
      delivery_days: { type: INTEGER, allowNull: false },
      revisions: INTEGER,
      features: { type: jsonType },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('gig_addons', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      gig_id: { type: uuidType, allowNull: false },
      title: { type: STRING, allowNull: false },
      description: TEXT,
      price: { type: DECIMAL, allowNull: false },
      delivery_days: INTEGER,
      metadata: { type: jsonType },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('gig_faq', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      gig_id: { type: uuidType, allowNull: false },
      question: { type: STRING, allowNull: false },
      answer: { type: TEXT, allowNull: false },
      sort_order: INTEGER,
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('gig_media', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      gig_id: { type: uuidType, allowNull: false },
      type: { type: enumType(['image', 'video', 'document']), allowNull: false, defaultValue: 'image' },
      url: { type: STRING, allowNull: false },
      sort_order: INTEGER,
      metadata: { type: jsonType },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('gig_orders', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      gig_id: { type: uuidType, allowNull: false },
      buyer_id: { type: uuidType, allowNull: false },
      seller_id: { type: uuidType, allowNull: false },
      package_tier: { type: enumType(['basic', 'standard', 'premium']), allowNull: false },
      price: { type: DECIMAL, allowNull: false },
      currency: { type: STRING, defaultValue: 'USD' },
      status: {
        type: enumType(['pending', 'in_progress', 'delivered', 'completed', 'cancelled', 'disputed']),
        allowNull: false,
        defaultValue: 'pending',
      },
      requirements: TEXT,
      notes: TEXT,
      metadata: { type: jsonType },
      placed_at: { type: DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      started_at: DATE,
      delivered_at: DATE,
      completed_at: DATE,
      cancelled_at: DATE,
      cancellation_reason: TEXT,
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('order_submissions', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      order_id: { type: uuidType, allowNull: false },
      submitter_id: { type: uuidType, allowNull: false },
      message: TEXT,
      attachments: { type: jsonType },
      status: {
        type: enumType(['submitted', 'revision_requested', 'accepted']),
        allowNull: false,
        defaultValue: 'submitted',
      },
      submitted_at: { type: DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      responded_at: DATE,
      metadata: { type: jsonType },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('order_reviews', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      order_id: { type: uuidType, allowNull: false },
      reviewer_id: { type: uuidType, allowNull: false },
      reviewee_id: { type: uuidType, allowNull: false },
      rating: { type: INTEGER, allowNull: false },
      comment: TEXT,
      metadata: { type: jsonType },
      deleted_at: DATE,
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

    await queryInterface.addConstraint('project_tags', {
      type: 'foreign key',
      fields: ['project_id'],
      name: 'project_tags_project_id_fkey',
      references: { table: 'projects', field: 'id' },
      onDelete: 'cascade',
    });
    await queryInterface.addConstraint('project_tags', {
      type: 'foreign key',
      fields: ['tag_id'],
      name: 'project_tags_tag_id_fkey',
      references: { table: 'tags', field: 'id' },
      onDelete: 'cascade',
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
      fields: ['freelancer_id'],
      name: 'project_invites_freelancer_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });
    await queryInterface.addConstraint('project_invites', {
      type: 'foreign key',
      fields: ['inviter_id'],
      name: 'project_invites_inviter_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
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

    await queryInterface.addConstraint('project_milestones', {
      type: 'foreign key',
      fields: ['project_id'],
      name: 'project_milestones_project_id_fkey',
      references: { table: 'projects', field: 'id' },
      onDelete: 'cascade',
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
      fields: ['submitter_id'],
      name: 'project_deliverables_submitter_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });
    await queryInterface.addConstraint('project_deliverables', {
      type: 'foreign key',
      fields: ['reviewer_id'],
      name: 'project_deliverables_reviewer_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'set null',
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
    await queryInterface.addConstraint('project_time_logs', {
      type: 'foreign key',
      fields: ['approved_by'],
      name: 'project_time_logs_approved_by_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'set null',
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

    await queryInterface.addConstraint('gigs', {
      type: 'foreign key',
      fields: ['seller_id'],
      name: 'gigs_seller_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('gig_tags', {
      type: 'foreign key',
      fields: ['gig_id'],
      name: 'gig_tags_gig_id_fkey',
      references: { table: 'gigs', field: 'id' },
      onDelete: 'cascade',
    });
    await queryInterface.addConstraint('gig_tags', {
      type: 'foreign key',
      fields: ['tag_id'],
      name: 'gig_tags_tag_id_fkey',
      references: { table: 'tags', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('gig_packages', {
      type: 'foreign key',
      fields: ['gig_id'],
      name: 'gig_packages_gig_id_fkey',
      references: { table: 'gigs', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('gig_addons', {
      type: 'foreign key',
      fields: ['gig_id'],
      name: 'gig_addons_gig_id_fkey',
      references: { table: 'gigs', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('gig_faq', {
      type: 'foreign key',
      fields: ['gig_id'],
      name: 'gig_faq_gig_id_fkey',
      references: { table: 'gigs', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('gig_media', {
      type: 'foreign key',
      fields: ['gig_id'],
      name: 'gig_media_gig_id_fkey',
      references: { table: 'gigs', field: 'id' },
      onDelete: 'cascade',
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

    await queryInterface.addConstraint('order_submissions', {
      type: 'foreign key',
      fields: ['order_id'],
      name: 'order_submissions_order_id_fkey',
      references: { table: 'gig_orders', field: 'id' },
      onDelete: 'cascade',
    });
    await queryInterface.addConstraint('order_submissions', {
      type: 'foreign key',
      fields: ['submitter_id'],
      name: 'order_submissions_submitter_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('order_reviews', {
      type: 'foreign key',
      fields: ['order_id'],
      name: 'order_reviews_order_id_fkey',
      references: { table: 'gig_orders', field: 'id' },
      onDelete: 'cascade',
    });
    await queryInterface.addConstraint('order_reviews', {
      type: 'foreign key',
      fields: ['reviewer_id'],
      name: 'order_reviews_reviewer_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });
    await queryInterface.addConstraint('order_reviews', {
      type: 'foreign key',
      fields: ['reviewee_id'],
      name: 'order_reviews_reviewee_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('projects', {
      type: 'foreign key',
      fields: ['awarded_bid_id'],
      name: 'projects_awarded_bid_id_fkey',
      references: { table: 'project_bids', field: 'id' },
      onDelete: 'set null',
    });

    await queryInterface.addIndex('projects', ['owner_id']);
    await queryInterface.addIndex('projects', ['status']);
    await queryInterface.addIndex('project_bids', ['project_id', 'status']);
    await queryInterface.addIndex('gig_orders', ['buyer_id']);
    await queryInterface.addIndex('gig_orders', ['seller_id']);
    await queryInterface.addIndex('gigs', ['seller_id']);
    await queryInterface.addIndex('gigs', ['status']);
  },

  async down(queryInterface) {
    const tables = [
      'order_reviews',
      'order_submissions',
      'gig_orders',
      'gig_media',
      'gig_faq',
      'gig_addons',
      'gig_packages',
      'gig_tags',
      'gigs',
      'project_reviews',
      'project_time_logs',
      'project_deliverables',
      'project_milestones',
      'project_bids',
      'project_invites',
      'project_tags',
      'projects',
    ];
    // Drop in reverse order with constraint auto-handled
    // Some dialects require removing indexes manually
    await Promise.all(
      ['projects_owner_id_fkey', 'projects_awarded_bid_id_fkey'].map((name) =>
        queryInterface.removeConstraint('projects', name).catch(() => null)
      )
    );
    for (const table of tables) {
      await queryInterface.dropTable(table).catch(() => null);
    }
  },
};
