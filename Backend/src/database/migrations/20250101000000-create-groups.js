'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, STRING, TEXT, DATE, ENUM, JSONB, JSON } = Sequelize;
    const dialect = queryInterface.sequelize.getDialect();
    const jsonType = dialect === 'postgres' ? JSONB : JSON;
    const enumType = (values) => (dialect === 'sqlite' ? STRING : ENUM(...values));
    const uuidType = dialect === 'sqlite' ? STRING : UUID;
    const uuidDefault = Sequelize.UUIDV4;

    await queryInterface.createTable('groups', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      name: { type: STRING, allowNull: false },
      slug: { type: STRING, allowNull: false, unique: true },
      description: TEXT,
      visibility: { type: enumType(['public', 'private']), allowNull: false, defaultValue: 'public' },
      cover_image_url: STRING,
      metadata: { type: jsonType },
      created_by: { type: uuidType, allowNull: false },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('groups', ['slug'], { unique: true, name: 'groups_slug_unique' });
    await queryInterface.addIndex('groups', ['created_by'], { name: 'groups_created_by_idx' });
    await queryInterface.addConstraint('groups', {
      type: 'foreign key',
      name: 'groups_created_by_fkey',
      fields: ['created_by'],
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.createTable('group_members', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      group_id: { type: uuidType, allowNull: false },
      user_id: { type: uuidType, allowNull: false },
      role: { type: enumType(['member', 'mod', 'owner']), allowNull: false, defaultValue: 'member' },
      joined_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('group_members', {
      type: 'unique',
      name: 'group_members_group_user_unique',
      fields: ['group_id', 'user_id'],
    });

    await queryInterface.addConstraint('group_members', {
      type: 'foreign key',
      name: 'group_members_group_id_fkey',
      fields: ['group_id'],
      references: { table: 'groups', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('group_members', {
      type: 'foreign key',
      name: 'group_members_user_id_fkey',
      fields: ['user_id'],
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.createTable('group_tags', {
      group_id: { type: uuidType, allowNull: false },
      tag_id: { type: uuidType, allowNull: false },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('group_tags', {
      type: 'primary key',
      fields: ['group_id', 'tag_id'],
      name: 'group_tags_pk',
    });

    await queryInterface.addConstraint('group_tags', {
      type: 'foreign key',
      name: 'group_tags_group_id_fkey',
      fields: ['group_id'],
      references: { table: 'groups', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addConstraint('group_tags', {
      type: 'foreign key',
      name: 'group_tags_tag_id_fkey',
      fields: ['tag_id'],
      references: { table: 'tags', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.addColumn('posts', 'group_id', {
      type: uuidType,
      allowNull: true,
      references: { model: 'groups', key: 'id' },
      onDelete: 'set null',
    });

    await queryInterface.addIndex('posts', ['group_id'], { name: 'posts_group_id_idx' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('posts', 'posts_group_id_idx');
    await queryInterface.removeColumn('posts', 'group_id');
    await queryInterface.dropTable('group_tags');
    await queryInterface.dropTable('group_members');
    await queryInterface.dropTable('groups');
  },
};
