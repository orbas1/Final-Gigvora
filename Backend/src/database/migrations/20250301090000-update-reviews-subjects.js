'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn(
        'reviews',
        'subject_type',
        {
          type: Sequelize.ENUM('profile', 'project', 'order'),
          allowNull: true,
        },
        { transaction }
      );

      await queryInterface.addColumn(
        'reviews',
        'subject_id',
        {
          type: Sequelize.UUID,
          allowNull: true,
        },
        { transaction }
      );

      await queryInterface.sequelize.query(
        "UPDATE reviews SET subject_type = 'profile', subject_id = profile_id WHERE subject_type IS NULL",
        { transaction }
      );

      await queryInterface.changeColumn(
        'reviews',
        'subject_type',
        {
          type: Sequelize.ENUM('profile', 'project', 'order'),
          allowNull: false,
        },
        { transaction }
      );

      await queryInterface.changeColumn(
        'reviews',
        'subject_id',
        {
          type: Sequelize.UUID,
          allowNull: false,
        },
        { transaction }
      );

      await queryInterface.addIndex('reviews', ['subject_type', 'subject_id'], {
        name: 'reviews_subject_lookup',
        transaction,
      });

      await queryInterface.addConstraint('reviews', {
        fields: ['subject_type', 'subject_id', 'reviewer_id'],
        type: 'unique',
        name: 'reviews_unique_subject_reviewer',
        transaction,
      });

      await queryInterface.removeColumn('reviews', 'profile_id', { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn(
        'reviews',
        'profile_id',
        {
          type: Sequelize.UUID,
          allowNull: true,
        },
        { transaction }
      );

      await queryInterface.sequelize.query(
        "UPDATE reviews SET profile_id = subject_id WHERE subject_type = 'profile'",
        { transaction }
      );

      await queryInterface.changeColumn(
        'reviews',
        'profile_id',
        {
          type: Sequelize.UUID,
          allowNull: false,
        },
        { transaction }
      );

      await queryInterface.removeConstraint('reviews', 'reviews_unique_subject_reviewer', { transaction });
      await queryInterface.removeIndex('reviews', 'reviews_subject_lookup', { transaction });

      await queryInterface.removeColumn('reviews', 'subject_id', { transaction });
      await queryInterface.removeColumn('reviews', 'subject_type', { transaction });

      if (queryInterface.sequelize.getDialect() === 'postgres') {
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_reviews_subject_type";', {
          transaction,
        });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
