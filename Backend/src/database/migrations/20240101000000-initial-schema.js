'use strict';

const uuid = 'UUID';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, STRING, TEXT, DATE, BOOLEAN, JSONB, JSON, ENUM, INTEGER, DECIMAL } = Sequelize;
    const dialect = queryInterface.sequelize.getDialect();
    const jsonType = dialect === 'postgres' ? JSONB : JSON;
    const enumType = (values) => (dialect === 'sqlite' ? STRING : ENUM(...values));
    const uuidType = dialect === 'sqlite' ? STRING : UUID;
    const uuidDefault = Sequelize.UUIDV4;

    await queryInterface.createTable('users', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      email: { type: STRING, allowNull: false, unique: true },
      password_hash: { type: STRING, allowNull: false },
      role: { type: enumType(['user', 'freelancer', 'client', 'admin']), allowNull: false, defaultValue: 'user' },
      active_role: { type: STRING },
      org_id: { type: uuidType },
      is_verified: { type: BOOLEAN, defaultValue: false },
      status: { type: STRING, defaultValue: 'active' },
      two_factor_secret: { type: STRING },
      last_login_at: { type: DATE },
      metadata: { type: jsonType },
      deleted_at: { type: DATE },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('sessions', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      user_id: { type: uuidType, allowNull: false },
      user_agent: STRING,
      ip_address: STRING,
      refresh_token_hash: STRING,
      expires_at: DATE,
      revoked_at: DATE,
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addConstraint('sessions', {
      type: 'foreign key',
      fields: ['user_id'],
      name: 'sessions_user_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.createTable('profiles', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      user_id: { type: uuidType, allowNull: false, unique: true },
      display_name: STRING,
      headline: STRING,
      bio: TEXT,
      location: STRING,
      avatar_url: STRING,
      banner_url: STRING,
      socials: { type: jsonType },
      hourly_rate: DECIMAL,
      currency: STRING,
      visibility: { type: enumType(['public', 'private', 'connections']), defaultValue: 'public' },
      analytics_snapshot: { type: jsonType },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addConstraint('profiles', {
      type: 'foreign key',
      fields: ['user_id'],
      name: 'profiles_user_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.createTable('profile_experiences', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      profile_id: { type: uuidType, allowNull: false },
      title: STRING,
      company: STRING,
      start_date: DATE,
      end_date: DATE,
      is_current: BOOLEAN,
      description: TEXT,
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addConstraint('profile_experiences', {
      type: 'foreign key',
      fields: ['profile_id'],
      name: 'profile_experiences_profile_id_fkey',
      references: { table: 'profiles', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.createTable('profile_education', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      profile_id: { type: uuidType, allowNull: false },
      school: STRING,
      degree: STRING,
      field: STRING,
      start_date: DATE,
      end_date: DATE,
      description: TEXT,
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addConstraint('profile_education', {
      type: 'foreign key',
      fields: ['profile_id'],
      name: 'profile_education_profile_id_fkey',
      references: { table: 'profiles', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.createTable('skills', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      name: { type: STRING, unique: true },
      description: TEXT,
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('profile_skills', {
      profile_id: { type: uuidType, allowNull: false },
      skill_id: { type: uuidType, allowNull: false },
      proficiency: STRING,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addConstraint('profile_skills', {
      type: 'primary key',
      fields: ['profile_id', 'skill_id'],
      name: 'profile_skills_pk',
    });

    await queryInterface.createTable('tags', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      name: { type: STRING, unique: true },
      description: TEXT,
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('profile_tags', {
      profile_id: { type: uuidType, allowNull: false },
      tag_id: { type: uuidType, allowNull: false },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addConstraint('profile_tags', {
      type: 'primary key',
      fields: ['profile_id', 'tag_id'],
      name: 'profile_tags_pk',
    });

    await queryInterface.createTable('portfolio_items', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      profile_id: { type: uuidType, allowNull: false },
      title: STRING,
      description: TEXT,
      url: STRING,
      media: { type: jsonType },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addConstraint('portfolio_items', {
      type: 'foreign key',
      fields: ['profile_id'],
      name: 'portfolio_items_profile_id_fkey',
      references: { table: 'profiles', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.createTable('reviews', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      profile_id: { type: uuidType, allowNull: false },
      reviewer_id: { type: uuidType, allowNull: false },
      rating: { type: INTEGER, allowNull: false },
      comment: TEXT,
      metadata: { type: jsonType },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('user_follows', {
      follower_id: { type: uuidType, allowNull: false },
      followee_id: { type: uuidType, allowNull: false },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addConstraint('user_follows', {
      type: 'primary key',
      fields: ['follower_id', 'followee_id'],
      name: 'user_follows_pk',
    });

    await queryInterface.createTable('user_blocks', {
      blocker_id: { type: uuidType, allowNull: false },
      blocked_id: { type: uuidType, allowNull: false },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addConstraint('user_blocks', {
      type: 'primary key',
      fields: ['blocker_id', 'blocked_id'],
      name: 'user_blocks_pk',
    });

    await queryInterface.createTable('user_reports', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      reporter_id: { type: uuidType, allowNull: false },
      reported_id: { type: uuidType, allowNull: false },
      reason: STRING,
      description: TEXT,
      status: { type: enumType(['pending', 'reviewed', 'actioned']), defaultValue: 'pending' },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('connections', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      requester_id: { type: uuidType, allowNull: false },
      addressee_id: { type: uuidType, allowNull: false },
      status: { type: enumType(['pending', 'accepted', 'rejected']), defaultValue: 'pending' },
      note: TEXT,
      responded_at: DATE,
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('posts', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      user_id: { type: uuidType, allowNull: false },
      content: TEXT,
      attachments: { type: jsonType },
      share_ref: { type: jsonType },
      visibility: { type: enumType(['public', 'connections', 'private']), defaultValue: 'public' },
      analytics_snapshot: { type: jsonType },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('comments', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      post_id: { type: uuidType, allowNull: false },
      user_id: { type: uuidType, allowNull: false },
      content: TEXT,
      parent_id: { type: uuidType },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('reactions', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      post_id: { type: uuidType, allowNull: false },
      user_id: { type: uuidType, allowNull: false },
      type: STRING,
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('notifications', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      user_id: { type: uuidType, allowNull: false },
      type: STRING,
      data: { type: jsonType },
      read_at: DATE,
      channel: STRING,
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('user_settings', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      user_id: { type: uuidType, allowNull: false, unique: true },
      preferences: { type: jsonType },
      security: { type: jsonType },
      privacy: { type: jsonType },
      theme: { type: jsonType },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('email_verifications', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      user_id: { type: uuidType, allowNull: false },
      token: { type: STRING, allowNull: false, unique: true },
      expires_at: DATE,
      consumed_at: DATE,
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('password_resets', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      user_id: { type: uuidType, allowNull: false },
      token: { type: STRING, allowNull: false, unique: true },
      expires_at: DATE,
      consumed_at: DATE,
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('otp_codes', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      user_id: { type: uuidType, allowNull: false },
      channel: { type: enumType(['email', 'sms']), defaultValue: 'email' },
      code: { type: STRING, allowNull: false },
      expires_at: DATE,
      consumed_at: DATE,
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('files', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      owner_id: { type: uuidType, allowNull: false },
      filename: STRING,
      storage_key: STRING,
      mime_type: STRING,
      size_bytes: INTEGER,
      metadata: { type: jsonType },
      scanned_at: DATE,
      status: { type: enumType(['pending', 'ready', 'blocked']), defaultValue: 'pending' },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('idempotency_keys', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      key: { type: STRING, allowNull: false, unique: true },
      user_id: { type: uuidType },
      method: STRING,
      path: STRING,
      request_hash: STRING,
      response_body: { type: jsonType },
      response_status: INTEGER,
      locked_at: DATE,
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('support_tickets', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      user_id: { type: uuidType, allowNull: false },
      status: { type: enumType(['open', 'pending', 'closed']), defaultValue: 'open' },
      subject: STRING,
      priority: { type: enumType(['low', 'normal', 'high']), defaultValue: 'normal' },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('support_messages', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      ticket_id: { type: uuidType, allowNull: false },
      user_id: { type: uuidType },
      body: TEXT,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('verification_requests', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      subject_type: { type: enumType(['user', 'org']), allowNull: false },
      subject_id: { type: uuidType, allowNull: false },
      status: { type: enumType(['pending', 'verified', 'rejected']), defaultValue: 'pending' },
      data: { type: jsonType },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('webhook_subscriptions', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      name: STRING,
      url: STRING,
      events: { type: jsonType },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropAllTables();
  },
};
