'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, STRING, TEXT, DATE, JSONB, JSON, ENUM } = Sequelize;
    const dialect = queryInterface.sequelize.getDialect();
    const jsonType = dialect === 'postgres' ? JSONB : JSON;
    const enumType = (values) => (dialect === 'sqlite' ? STRING : ENUM(...values));
    const uuidType = dialect === 'sqlite' ? STRING : UUID;
    const uuidDefault = Sequelize.UUIDV4;

    const addColumnIfMissing = async (table, column, definition) => {
      const description = await queryInterface.describeTable(table);
      if (!description[column]) {
        await queryInterface.addColumn(table, column, definition);
      }
    };

    await addColumnIfMissing('user_settings', 'account', { type: jsonType });
    await addColumnIfMissing('user_settings', 'notifications', { type: jsonType });
    await addColumnIfMissing('user_settings', 'payments', { type: jsonType });
    await addColumnIfMissing('user_settings', 'theme_tokens', { type: jsonType });
    await addColumnIfMissing('user_settings', 'api_preferences', { type: jsonType });

    const tableDefinition = await queryInterface.describeTable('user_settings');
    if (!tableDefinition.created_at) {
      await addColumnIfMissing('user_settings', 'created_at', {
        type: DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      });
    }
    if (!tableDefinition.updated_at) {
      await addColumnIfMissing('user_settings', 'updated_at', {
        type: DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      });
    }

    const tables = await queryInterface.showAllTables();
    if (!tables.includes('api_tokens')) {
      await queryInterface.createTable('api_tokens', {
        id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
        user_id: { type: uuidType, allowNull: false },
        name: { type: STRING, allowNull: false },
        description: TEXT,
        token_hash: { type: STRING, allowNull: false },
        token_prefix: { type: STRING, allowNull: false },
        token_last4: { type: STRING, allowNull: false },
        scopes: { type: jsonType },
        status: { type: enumType(['active', 'revoked', 'expired']), allowNull: false, defaultValue: 'active' },
        ip_allowlist: { type: jsonType },
        metadata: { type: jsonType },
        last_used_at: DATE,
        last_used_ip: STRING,
        expires_at: DATE,
        deleted_at: DATE,
        created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });

      await queryInterface.addConstraint('api_tokens', {
        type: 'foreign key',
        fields: ['user_id'],
        name: 'api_tokens_user_id_fkey',
        references: { table: 'users', field: 'id' },
        onDelete: 'cascade',
      });

      await queryInterface.addIndex('api_tokens', ['token_hash'], {
        unique: true,
        name: 'api_tokens_token_hash_key',
      });

      await queryInterface.addIndex('api_tokens', ['user_id', 'deleted_at'], {
        name: 'api_tokens_user_id_deleted_at_idx',
      });
    }
  },

  async down(queryInterface) {
    const removeColumnIfExists = async (table, column) => {
      try {
        const description = await queryInterface.describeTable(table);
        if (description[column]) {
          await queryInterface.removeColumn(table, column);
        }
      } catch (error) {
        if (process.env.NODE_ENV !== 'test') {
          console.warn(`Skipping removal of ${table}.${column}:`, error.message);
        }
      }
    };

    const tables = await queryInterface.showAllTables();
    if (tables.includes('api_tokens')) {
      await queryInterface.dropTable('api_tokens');
    }

    await removeColumnIfExists('user_settings', 'api_preferences');
    await removeColumnIfExists('user_settings', 'theme_tokens');
    await removeColumnIfExists('user_settings', 'payments');
    await removeColumnIfExists('user_settings', 'notifications');
    await removeColumnIfExists('user_settings', 'account');
  },
};
