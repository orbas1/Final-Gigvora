'use strict';

const { Model, DataTypes } = require('sequelize');
const { jsonColumn } = require('./helpers/columnTypes');

const SUBJECT_TYPES = ['profile', 'project', 'order'];

module.exports = (sequelize) => {
  class Review extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'reviewer_id', as: 'reviewer' });
      this.belongsTo(models.Profile, {
        foreignKey: 'subject_id',
        as: 'profileSubject',
        constraints: false,
      });
      this.belongsTo(models.Job, {
        foreignKey: 'subject_id',
        as: 'projectSubject',
        constraints: false,
      });
      this.belongsTo(models.EscrowIntent, {
        foreignKey: 'subject_id',
        as: 'orderSubject',
        constraints: false,
      });
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
        type: DataTypes.ENUM(...SUBJECT_TYPES),
        allowNull: false,
        set(value) {
          if (typeof value === 'string') {
            this.setDataValue('subject_type', value.toLowerCase());
          } else {
            this.setDataValue('subject_type', value);
          }
        },
        validate: {
          isIn: [SUBJECT_TYPES],
        },
      },
      subject_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      reviewer_id: {
        type: DataTypes.UUID,
        allowNull: false,
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
      metadata: jsonColumn(sequelize, DataTypes),
    },
    {
      sequelize,
      modelName: 'Review',
      tableName: 'reviews',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      paranoid: true,
      deletedAt: 'deleted_at',
      indexes: [
        { fields: ['subject_type', 'subject_id'] },
        { fields: ['reviewer_id'] },
      ],
    }
  );

  Review.addScope('forProfile', {
    where: { subject_type: 'profile' },
  });

  return Review;
};
