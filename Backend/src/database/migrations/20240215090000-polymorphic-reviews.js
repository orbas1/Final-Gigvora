'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();
    const uuidType = dialect === 'sqlite' ? Sequelize.STRING : Sequelize.UUID;
    const enumType = dialect === 'sqlite' ? Sequelize.STRING : Sequelize.ENUM('project', 'order', 'profile');

    await queryInterface.addColumn('reviews', 'subject_type', {
      type: enumType,
      allowNull: false,
      defaultValue: 'profile',
    });

    await queryInterface.addColumn('reviews', 'subject_id', {
      type: uuidType,
      allowNull: true,
    });

    await queryInterface.sequelize.query('UPDATE reviews SET subject_id = profile_id WHERE subject_id IS NULL');

    if (dialect !== 'sqlite') {
      await queryInterface.changeColumn('reviews', 'subject_id', {
        type: uuidType,
        allowNull: false,
      });
    }

    try {
      await queryInterface.changeColumn('reviews', 'profile_id', {
        type: uuidType,
        allowNull: true,
      });
    } catch (error) {
      if (dialect !== 'sqlite') {
        throw error;
      }
    }

    await queryInterface.addIndex('reviews', ['subject_type', 'subject_id'], {
      name: 'reviews_subject_lookup',
    });

    await queryInterface.addIndex('reviews', ['subject_type', 'subject_id', 'reviewer_id'], {
      name: 'reviews_subject_reviewer_unique',
      unique: true,
    });

    await queryInterface.addIndex('reviews', ['created_at'], {
      name: 'reviews_created_at_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();
    const uuidType = dialect === 'sqlite' ? Sequelize.STRING : Sequelize.UUID;

    await queryInterface.removeIndex('reviews', 'reviews_created_at_idx').catch(() => {});
    await queryInterface.removeIndex('reviews', 'reviews_subject_reviewer_unique').catch(() => {});
    await queryInterface.removeIndex('reviews', 'reviews_subject_lookup').catch(() => {});

    try {
      await queryInterface.changeColumn('reviews', 'profile_id', {
        type: uuidType,
        allowNull: false,
      });
    } catch (error) {
      if (dialect !== 'sqlite') {
        throw error;
      }
    }

    await queryInterface.removeColumn('reviews', 'subject_id');
    await queryInterface.removeColumn('reviews', 'subject_type');

    if (dialect === 'postgres') {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_reviews_subject_type"');
    }
  },
};
