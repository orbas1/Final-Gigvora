'use strict';

const { Model, DataTypes } = require('sequelize');

const SUBJECT_TYPES = ['project', 'order', 'profile'];

module.exports = (sequelize) => {
  class Review extends Model {
    static associate(models) {
      this.belongsTo(models.Profile, { foreignKey: 'profile_id', as: 'profile' });
      this.belongsTo(models.User, { foreignKey: 'reviewer_id', as: 'reviewer' });
    }

    static get subjectTypes() {
      return SUBJECT_TYPES;
    }
  }

  Review.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      subject_type: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isIn: [SUBJECT_TYPES],
        },
        unique: 'reviews_subject_reviewer_unique',
      },
      subject_id: {
        type: DataTypes.UUID,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
        unique: 'reviews_subject_reviewer_unique',
      },
      profile_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      reviewer_id: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: 'reviews_subject_reviewer_unique',
      },
      rating: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
          max: 5,
        },
      },
      comment: DataTypes.TEXT,
      metadata: DataTypes.JSONB || DataTypes.JSON,
    },
    {
      sequelize,
      modelName: 'Review',
      tableName: 'reviews',
      indexes: [
        { fields: ['subject_type', 'subject_id'] },
        { fields: ['subject_type', 'subject_id', 'reviewer_id'], unique: true, name: 'reviews_subject_reviewer_unique' },
        { fields: ['created_at'] },
      ],
    }
  );

  return Review;
};
