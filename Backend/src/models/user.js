'use strict';

const { Model, DataTypes } = require('sequelize');
const { getJsonType } = require('../utils/sequelize');
const bcrypt = require('bcrypt');
const { v4: uuid } = require('uuid');

module.exports = (sequelize) => {
  const jsonType = getJsonType(sequelize, DataTypes);
  class User extends Model {
    static associate(models) {
      this.hasOne(models.Profile, { foreignKey: 'user_id', as: 'profile' });
      this.hasMany(models.Session, { foreignKey: 'user_id', as: 'sessions' });
      this.hasMany(models.EmailVerification, { foreignKey: 'user_id', as: 'emailVerifications' });
      this.hasMany(models.PasswordReset, { foreignKey: 'user_id', as: 'passwordResets' });
      this.hasMany(models.OtpCode, { foreignKey: 'user_id', as: 'otpCodes' });
      this.belongsToMany(models.User, {
        as: 'followers',
        through: models.UserFollow,
        foreignKey: 'followee_id',
        otherKey: 'follower_id',
      });
      this.belongsToMany(models.User, {
        as: 'following',
        through: models.UserFollow,
        foreignKey: 'follower_id',
        otherKey: 'followee_id',
      });
      this.belongsToMany(models.User, {
        as: 'blockedUsers',
        through: models.UserBlock,
        foreignKey: 'blocker_id',
        otherKey: 'blocked_id',
      });
      this.belongsToMany(models.User, {
        as: 'blockedByUsers',
        through: models.UserBlock,
        foreignKey: 'blocked_id',
        otherKey: 'blocker_id',
      });
      this.hasMany(models.UserReport, { foreignKey: 'reporter_id', as: 'reportsMade' });
      this.hasMany(models.UserReport, { foreignKey: 'reported_id', as: 'reportsReceived' });
      this.hasMany(models.Connection, { foreignKey: 'requester_id', as: 'connectionRequests' });
      this.hasMany(models.Connection, { foreignKey: 'addressee_id', as: 'connectionsReceived' });
      this.hasMany(models.Post, { foreignKey: 'user_id', as: 'posts' });
      this.hasMany(models.Notification, { foreignKey: 'user_id', as: 'notifications' });
      this.hasOne(models.UserSetting, { foreignKey: 'user_id', as: 'settings' });
      this.hasMany(models.Project, { foreignKey: 'owner_id', as: 'ownedProjects' });
      this.hasMany(models.ProjectInvite, { foreignKey: 'freelancer_id', as: 'projectInvites' });
      this.hasMany(models.ProjectInvite, { foreignKey: 'inviter_id', as: 'projectInvitesSent' });
      this.hasMany(models.ProjectBid, { foreignKey: 'bidder_id', as: 'projectBids' });
      this.hasMany(models.ProjectDeliverable, { foreignKey: 'submitter_id', as: 'projectDeliverablesSubmitted' });
      this.hasMany(models.ProjectDeliverable, { foreignKey: 'reviewer_id', as: 'projectDeliverablesReviewed' });
      this.hasMany(models.ProjectTimeLog, { foreignKey: 'user_id', as: 'projectTimeLogs' });
      this.hasMany(models.ProjectTimeLog, { foreignKey: 'approved_by', as: 'projectTimeLogApprovals' });
      this.hasMany(models.ProjectReview, { foreignKey: 'reviewer_id', as: 'projectReviewsAuthored' });
      this.hasMany(models.ProjectReview, { foreignKey: 'reviewee_id', as: 'projectReviewsReceived' });
      this.hasMany(models.Gig, { foreignKey: 'seller_id', as: 'gigs' });
      this.hasMany(models.GigOrder, { foreignKey: 'buyer_id', as: 'orders' });
      this.hasMany(models.GigOrder, { foreignKey: 'seller_id', as: 'sales' });
      this.hasMany(models.OrderSubmission, { foreignKey: 'submitter_id', as: 'orderSubmissions' });
      this.hasMany(models.OrderReview, { foreignKey: 'reviewer_id', as: 'orderReviewsAuthored' });
      this.hasMany(models.OrderReview, { foreignKey: 'reviewee_id', as: 'orderReviewsReceived' });
    }

    async validatePassword(password) {
      return bcrypt.compare(password, this.password_hash);
    }
  }

  User.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuid(),
        primaryKey: true,
      },
      email: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
        validate: { isEmail: true },
      },
      password_hash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      role: {
        type: DataTypes.ENUM('user', 'freelancer', 'client', 'admin'),
        allowNull: false,
        defaultValue: 'user',
      },
      active_role: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      org_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      is_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      status: {
        type: DataTypes.STRING,
        defaultValue: 'active',
      },
      two_factor_secret: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      last_login_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      metadata: {
        type: jsonType,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'users',
      defaultScope: {
        attributes: { exclude: ['password_hash', 'two_factor_secret'] },
      },
      scopes: {
        withSensitive: {},
      },
      hooks: {
        beforeCreate: async (user) => {
          if (user.password_hash) {
            user.password_hash = await bcrypt.hash(user.password_hash, 10);
          }
        },
        beforeUpdate: async (user) => {
          if (user.changed('password_hash')) {
            user.password_hash = await bcrypt.hash(user.password_hash, 10);
          }
        },
      },
    }
  );

  return User;
};
