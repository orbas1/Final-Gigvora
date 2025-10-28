const { Op, fn, col } = require('sequelize');
const dayjs = require('dayjs');
const {
  User,
  Profile,
  ProfileExperience,
  ProfileEducation,
  ProfileSkill,
  Skill,
  Tag,
  ProfileTag,
  PortfolioItem,
  Review,
  UserFollow,
  UserBlock,
  UserReport,
  Notification,
  Post,
  Session,
  sequelize,
} = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { buildPagination, encodeCursor } = require('../utils/pagination');
const { aggregateByPeriod } = require('../utils/analytics');

const buildFilters = (query) => {
  const where = {};
  if (query.role) where.role = query.role;
  if (query.verified) where.is_verified = query.verified === 'true';
  if (query.created_between) {
    const [from, to] = query.created_between.split(',');
    where.created_at = { [Op.between]: [new Date(from), new Date(to)] };
  }
  if (query.q) {
    const term = `%${query.q.toLowerCase()}%`;
    where[Op.or] = [
      sequelize.where(fn('lower', col('email')), { [Op.like]: term }),
      sequelize.where(fn('lower', col('profile.display_name')), { [Op.like]: term }),
    ];
  }
  return where;
};

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const listUsers = async (query, currentUser) => {
  const pagination = buildPagination(query, ['created_at', 'updated_at', 'last_login_at', 'email']);
  const skillsFilter = toArray(query.skills);
  const expand = new Set(toArray(query.expand));
  const includesFlag = new Set(toArray(query.include));
  const requestedFields = toArray(query.fields);
  const selectableFields = new Set([
    'id',
    'email',
    'role',
    'active_role',
    'org_id',
    'is_verified',
    'status',
    'last_login_at',
    'metadata',
    'created_at',
    'updated_at',
  ]);

  const where = buildFilters(query);
  const paranoid = !(currentUser?.role === 'admin' && includesFlag.has('deleted'));

  if (pagination.cursorValue !== undefined) {
    where[pagination.sortField] = {
      ...(where[pagination.sortField] || {}),
      [pagination.cursorOperator]: pagination.cursorValue,
    };
  }

  const profileInclude = {
    model: Profile,
    as: 'profile',
    required: false,
    attributes: ['id', 'display_name', 'headline', 'location', 'avatar_url', 'analytics_snapshot'],
  };

  if (query.location) {
    const term = `%${query.location.toLowerCase()}%`;
    profileInclude.where = {
      ...(profileInclude.where || {}),
      [Op.and]: [
        ...(profileInclude.where?.[Op.and] || []),
        sequelize.where(fn('lower', col('profile.location')), { [Op.like]: term }),
      ],
    };
    profileInclude.required = true;
  }

  profileInclude.include = profileInclude.include || [];

  if (skillsFilter.length) {
    profileInclude.include.push({
      model: Skill,
      as: 'skills',
      attributes: ['id', 'name'],
      through: { attributes: [] },
      where: { name: { [Op.in]: skillsFilter } },
      required: true,
    });
  } else if (expand.has('profile.skills')) {
    profileInclude.include.push({
      model: Skill,
      as: 'skills',
      attributes: ['id', 'name'],
      through: { attributes: [] },
    });
  }

  if (expand.has('profile.tags')) {
    profileInclude.include.push({
      model: Tag,
      as: 'tags',
      attributes: ['id', 'name'],
      through: { attributes: [] },
    });
  }

  if (expand.has('profile.portfolio')) {
    profileInclude.include.push({
      model: PortfolioItem,
      as: 'portfolio',
    });
  }

  if (expand.has('profile.reviews')) {
    profileInclude.include.push({
      model: Review,
      as: 'reviews',
    });
  }

  const include = [profileInclude];

  if (expand.has('followers')) {
    include.push({ association: 'followers', attributes: ['id', 'email'], through: { attributes: [] } });
  }

  if (expand.has('following')) {
    include.push({ association: 'following', attributes: ['id', 'email'], through: { attributes: [] } });
  }

  if (expand.has('settings')) {
    include.push({ association: 'settings' });
  }

  const filteredFields = requestedFields.filter((field) => selectableFields.has(field));
  const attributes = filteredFields.length
    ? Array.from(new Set([...filteredFields, 'id', pagination.sortField]))
    : undefined;

  const { rows, count } = await User.findAndCountAll({
    where,
    include,
    attributes,
    paranoid,
    limit: pagination.limit + 1,
    order: pagination.order,
    distinct: true,
    col: 'User.id',
    subQuery: false,
  });

  const hasMore = rows.length > pagination.limit;
  const slicedRows = hasMore ? rows.slice(0, pagination.limit) : rows;
  const data = slicedRows.map((row) => row.toJSON());
  const nextCursorValue = hasMore ? data[data.length - 1]?.[pagination.sortField] : undefined;
  const nextCursor = hasMore ? encodeCursor(nextCursorValue) : null;

  let analytics;
  if (query.analytics && currentUser?.role === 'admin') {
    const [activeUsers, deletedUsers] = await Promise.all([
      User.count(),
      User.count({
        paranoid: false,
        where: { deleted_at: { [Op.ne]: null } },
      }),
    ]);
    analytics = { active_users: activeUsers, deleted_users: deletedUsers };
  }

  return {
    data,
    total: typeof count === 'number' ? count : Array.isArray(count) ? count.length : 0,
    page: {
      next_cursor: nextCursor,
      limit: pagination.limit,
    },
    analytics,
  };
};

const createUser = async (body) => {
  const user = await User.create({
    email: body.email,
    password_hash: body.password,
    role: body.role || 'user',
    is_verified: body.is_verified || false,
  });
  await Profile.create({ user_id: user.id, display_name: body.display_name || body.email });
  return user;
};

const getUser = async (id, options = {}) => {
  const include = [{ model: Profile, as: 'profile' }];
  if (options.expand?.includes('followers')) {
    include.push({ association: 'followers' });
  }
  const user = await User.findByPk(id, { include, paranoid: !(options.includeDeleted && options.includeDeleted === 'true') });
  if (!user) {
    throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  }
  return user;
};

const updateUser = async (user, body) => {
  if (body.password) {
    user.password_hash = body.password;
  }
  if (body.role) user.role = body.role;
  if (body.metadata) user.metadata = body.metadata;
  if (body.is_verified !== undefined) user.is_verified = body.is_verified;
  await user.save();
  return user;
};

const softDeleteUser = async (user) => {
  await user.destroy();
  return { success: true };
};

const followUser = async (followerId, followeeId) => {
  if (followerId === followeeId) {
    throw new ApiError(400, 'Cannot follow yourself', 'INVALID_FOLLOW');
  }
  await UserFollow.findOrCreate({ where: { follower_id: followerId, followee_id: followeeId } });
  return { success: true };
};

const unfollowUser = async (followerId, followeeId) => {
  await UserFollow.destroy({ where: { follower_id: followerId, followee_id: followeeId } });
  return { success: true };
};

const blockUser = async (blockerId, blockedId) => {
  await UserBlock.findOrCreate({ where: { blocker_id: blockerId, blocked_id: blockedId } });
  return { success: true };
};

const unblockUser = async (blockerId, blockedId) => {
  await UserBlock.destroy({ where: { blocker_id: blockerId, blocked_id: blockedId } });
  return { success: true };
};

const reportUser = async (reporterId, reportedId, body) => {
  await UserReport.create({ reporter_id: reporterId, reported_id: reportedId, reason: body.reason, description: body.description });
  return { success: true };
};

const getFollowers = async (id) => {
  const user = await User.findByPk(id, { include: [{ association: 'followers' }] });
  if (!user) throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  return user.followers;
};

const getFollowing = async (id) => {
  const user = await User.findByPk(id, { include: [{ association: 'following' }] });
  if (!user) throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  return user.following;
};

const overviewAnalytics = async (id) => {
  const user = await User.findByPk(id, {
    include: [{ model: Profile, as: 'profile', attributes: ['analytics_snapshot'] }],
  });
  if (!user) {
    throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  }

  const snapshot = user.profile?.analytics_snapshot || {};
  const profileViews = Number(snapshot.profileViews ?? snapshot.profile_views ?? 0);

  const [follows, messages, posts] = await Promise.all([
    UserFollow.count({ where: { followee_id: id } }),
    Notification.count({
      where: {
        user_id: id,
        [Op.or]: [{ channel: 'message' }, { type: { [Op.like]: 'message%' } }],
      },
    }),
    Post.count({ where: { user_id: id } }),
  ]);

  return { profileViews, follows, messages, posts };
};

const retentionAnalytics = async ({ cohort = 'week', from, to }) => {
  const granularity = cohort === 'month' ? 'month' : 'week';
  const rangeStart = from || dayjs().subtract(90, 'day').toDate();
  const rangeEnd = to || new Date();
  return aggregateByPeriod(User, 'created_at', {
    granularity,
    from: rangeStart,
    to: rangeEnd,
  });
};

const activesAnalytics = async ({ granularity = 'day', from, to }) => {
  const bucket = ['week', 'month'].includes(granularity) ? granularity : 'day';
  const rangeStart = from || dayjs().subtract(30, 'day').toDate();
  const rangeEnd = to || new Date();
  return aggregateByPeriod(Session, 'created_at', {
    granularity: bucket,
    from: rangeStart,
    to: rangeEnd,
    distinct: 'user_id',
    extraWhere: ['revoked_at IS NULL'],
  });
};

module.exports = {
  listUsers,
  createUser,
  getUser,
  updateUser,
  softDeleteUser,
  followUser,
  unfollowUser,
  blockUser,
  unblockUser,
  reportUser,
  getFollowers,
  getFollowing,
  overviewAnalytics,
  retentionAnalytics,
  activesAnalytics,
};
