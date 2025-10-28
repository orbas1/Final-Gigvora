const dayjs = require('dayjs');
const { Op, fn, col, literal } = require('sequelize');
const {
  Post,
  Comment,
  Reaction,
  PostShare,
  PostActivity,
  FeedMetric,
  User,
  UserFollow,
  sequelize,
} = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { buildPagination, encodeCursor } = require('../utils/pagination');

const isAdmin = (user) => user?.role === 'admin';

const normalizeArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const cloneWhere = (condition = {}) => {
  const clone = {};
  for (const key of Object.keys(condition)) {
    const value = condition[key];
    clone[key] = Array.isArray(value) ? [...value] : value;
  }
  for (const sym of Object.getOwnPropertySymbols(condition)) {
    const value = condition[sym];
    clone[sym] = Array.isArray(value) ? [...value] : value;
  }
  return clone;
};

const defaultUserAttributes = ['id', 'email', 'role', 'active_role', 'created_at'];

const buildPostInclude = (expand = []) => {
  const include = [];
  const expansions = new Set(expand);

  if (expansions.has('author')) {
    include.push({ model: User, as: 'author', attributes: defaultUserAttributes });
  }

  if (expansions.has('comments')) {
    include.push({
      model: Comment,
      as: 'comments',
      required: false,
      where: { parent_id: null },
      separate: true,
      order: [['created_at', 'DESC']],
      limit: 25,
      include: [{ model: User, as: 'author', attributes: defaultUserAttributes }],
    });
  }

  if (expansions.has('reactions')) {
    include.push({
      model: Reaction,
      as: 'reactions',
      required: false,
      include: [{ model: User, as: 'user', attributes: defaultUserAttributes }],
    });
  }

  if (expansions.has('shares')) {
    include.push({
      model: PostShare,
      as: 'shares',
      required: false,
      include: [{ model: User, as: 'user', attributes: defaultUserAttributes }],
    });
  }

  return include;
};

const buildCommentInclude = (expand = []) => {
  const include = [{ model: User, as: 'author', attributes: defaultUserAttributes }];
  const expansions = new Set(expand);

  if (expansions.has('replies')) {
    include.push({
      model: Comment,
      as: 'replies',
      separate: true,
      required: false,
      order: [['created_at', 'ASC']],
      include: [{ model: User, as: 'author', attributes: defaultUserAttributes }],
    });
  }

  return include;
};

const buildVisibilityCondition = (query, currentUser) => {
  if (isAdmin(currentUser)) {
    return null;
  }

  const userId = currentUser?.id;
  if (userId && query.author_id && query.author_id === userId) {
    return null;
  }

  const allowed = ['public'];
  if (userId) {
    allowed.push('connections');
  }

  return { visibility: { [Op.in]: allowed } };
};

const buildPostFilters = async (query, currentUser) => {
  const where = {};
  const andConditions = [];

  if (query.author_id) {
    where.user_id = query.author_id;
  }

  if (query.org_id) {
    where.org_id = query.org_id;
  }

  if (query.feed === 'home' && currentUser) {
    const followees = await UserFollow.findAll({
      where: { follower_id: currentUser.id },
      attributes: ['followee_id'],
      raw: true,
    });
    const followeeIds = followees.map((row) => row.followee_id);
    const orConditions = [{ user_id: currentUser.id }];
    if (followeeIds.length) {
      orConditions.push({ user_id: { [Op.in]: followeeIds } });
    }
    where[Op.or] = orConditions;
  } else if (query.feed === 'profile' && query.author_id) {
    where.user_id = query.author_id;
  } else if ((query.feed === 'company' || query.feed === 'group') && query.org_id) {
    where.org_id = query.org_id;
  }

  if (query.q) {
    const term = `%${String(query.q).toLowerCase()}%`;
    if (sequelize.getDialect() === 'postgres') {
      andConditions.push({ content: { [Op.iLike]: term } });
    } else {
      andConditions.push(
        sequelize.where(fn('LOWER', col('Post.content')), {
          [Op.like]: term,
        })
      );
    }
  }

  const visibilityCondition = buildVisibilityCondition(query, currentUser);
  if (visibilityCondition) {
    andConditions.push(visibilityCondition);
  }

  if (andConditions.length) {
    where[Op.and] = andConditions;
  }

  return { where };
};

const computePostListAnalytics = async (filters, { includeDeleted } = {}) => {
  const [aggregate] = await Post.findAll({
    attributes: [
      [fn('COUNT', col('Post.id')), 'total_posts'],
      [fn('SUM', col('Post.comment_count')), 'total_comments'],
      [fn('SUM', col('Post.reaction_count')), 'total_reactions'],
      [fn('SUM', col('Post.share_count')), 'total_shares'],
      [fn('SUM', col('Post.view_count')), 'total_views'],
    ],
    where: filters,
    paranoid: !includeDeleted,
    raw: true,
  });

  const totals = aggregate || {};
  const posts = Number(totals.total_posts || 0);
  const comments = Number(totals.total_comments || 0);
  const reactions = Number(totals.total_reactions || 0);
  const shares = Number(totals.total_shares || 0);
  const views = Number(totals.total_views || 0);
  const interactions = comments + reactions + shares;
  const engagementRate = posts ? Number((interactions / posts).toFixed(4)) : 0;

  return {
    totals: {
      posts,
      comments,
      reactions,
      shares,
      views,
    },
    engagement_rate: engagementRate,
  };
};

const logPostActivity = async (postId, userId, type, metadata = {}, transaction) => {
  const payload = {
    post_id: postId,
    user_id: userId || null,
    type,
    metadata: metadata && Object.keys(metadata).length ? metadata : null,
  };
  await PostActivity.create(payload, { transaction });
};

const recordPostView = async (postId, { userId, metadata } = {}) => {
  const metaPayload = metadata && Object.keys(metadata).length ? metadata : null;
  await sequelize.transaction(async (transaction) => {
    let hasViewed = false;
    if (userId) {
      const existing = await PostActivity.findOne({
        where: { post_id: postId, user_id: userId, type: 'view' },
        transaction,
      });
      hasViewed = Boolean(existing);
    }

    await PostActivity.create(
      {
        post_id: postId,
        user_id: userId || null,
        type: 'view',
        metadata: metaPayload,
      },
      { transaction }
    );

    const updates = {
      view_count: literal('view_count + 1'),
      last_activity_at: new Date(),
    };

    if (!hasViewed && userId) {
      updates.unique_view_count = literal('unique_view_count + 1');
    }

    await Post.update(updates, { where: { id: postId }, transaction });
  });
};

const refreshPostCounts = async (
  postId,
  { transaction, comments = false, reactions = false, shares = false } = {}
) => {
  const updates = {};

  if (comments) {
    updates.comment_count = await Comment.count({ where: { post_id: postId }, transaction });
  }

  if (reactions) {
    updates.reaction_count = await Reaction.count({ where: { post_id: postId }, transaction });
  }

  if (shares) {
    updates.share_count = await PostShare.count({ where: { post_id: postId }, transaction });
  }

  if (Object.keys(updates).length) {
    updates.last_activity_at = new Date();
    await Post.update(updates, { where: { id: postId }, transaction });
  }

  return updates;
};

const listPosts = async (query, currentUser) => {
  const pagination = buildPagination(query, [
    'created_at',
    'last_activity_at',
    'view_count',
    'reaction_count',
  ]);
  const expand = normalizeArray(query.expand);
  const fields = normalizeArray(query.fields);
  const includeDeleted = Boolean(query.includeDeleted);

  const { where: baseFilters } = await buildPostFilters(query, currentUser);
  const findFilters = cloneWhere(baseFilters);

  if (pagination.cursorValue) {
    findFilters[pagination.sortField] = {
      [pagination.cursorOperator]: pagination.cursorValue,
    };
  }

  const include = buildPostInclude(expand);
  const attributes = fields.length
    ? Array.from(new Set([...fields, 'id', pagination.sortField]))
    : undefined;

  const posts = await Post.findAll({
    where: findFilters,
    include,
    attributes,
    limit: pagination.limit + 1,
    order: pagination.order,
    paranoid: !includeDeleted,
    distinct: true,
  });

  const hasMore = posts.length > pagination.limit;
  if (hasMore) {
    posts.pop();
  }

  const lastItem = posts[posts.length - 1];
  const nextCursor = hasMore && lastItem ? encodeCursor(lastItem.get(pagination.sortField)) : null;

  let analytics = null;
  if (query.analytics) {
    analytics = await computePostListAnalytics(baseFilters, { includeDeleted });
  }

  return {
    data: posts,
    meta: {
      limit: pagination.limit,
      next_cursor: nextCursor,
      sort: `${pagination.sortField}:${pagination.sortDirection}`,
    },
    analytics,
  };
};

const createPost = async (currentUser, payload) => {
  return sequelize.transaction(async (transaction) => {
    const post = await Post.create(
      {
        user_id: currentUser.id,
        org_id: payload.org_id || null,
        content: payload.content,
        attachments: payload.attachments || null,
        share_ref: payload.share_ref || null,
        visibility: payload.visibility || 'public',
        analytics_snapshot: payload.analytics_snapshot || null,
        last_activity_at: new Date(),
      },
      { transaction }
    );

    return post.reload({
      include: buildPostInclude(['author']),
      transaction,
    });
  });
};

const getPost = async (
  id,
  { expand = [], fields = [], includeDeleted = false, currentUser, recordView = true, requestContext = {} } = {}
) => {
  const include = buildPostInclude(expand);
  const attributes = fields.length ? Array.from(new Set([...fields, 'id'])) : undefined;

  const post = await Post.findByPk(id, {
    include,
    attributes,
    paranoid: !includeDeleted,
  });

  if (!post) {
    throw new ApiError(404, 'Post not found', 'POST_NOT_FOUND');
  }

  if (post.deleted_at && !isAdmin(currentUser)) {
    throw new ApiError(404, 'Post not found', 'POST_NOT_FOUND');
  }

  if (recordView) {
    await recordPostView(post.id, {
      userId: currentUser?.id,
      metadata: {
        ip: requestContext.ip,
        user_agent: requestContext.userAgent,
      },
    });
    await post.reload({ include, attributes });
  }

  return post;
};

const updatePost = async (id, currentUser, payload) => {
  return sequelize.transaction(async (transaction) => {
    const post = await Post.findByPk(id, { transaction, paranoid: false });
    if (!post) {
      throw new ApiError(404, 'Post not found', 'POST_NOT_FOUND');
    }

    if (post.deleted_at && !isAdmin(currentUser)) {
      throw new ApiError(404, 'Post not found', 'POST_NOT_FOUND');
    }

    if (post.user_id !== currentUser.id && !isAdmin(currentUser)) {
      throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
    }

    const updates = {};
    if (payload.content !== undefined) updates.content = payload.content;
    if (payload.attachments !== undefined) updates.attachments = payload.attachments;
    if (payload.share_ref !== undefined) updates.share_ref = payload.share_ref;
    if (payload.visibility !== undefined) updates.visibility = payload.visibility;
    if (payload.org_id !== undefined) updates.org_id = payload.org_id;
    if (payload.analytics_snapshot !== undefined) updates.analytics_snapshot = payload.analytics_snapshot;

    if (!Object.keys(updates).length) {
      return post;
    }

    updates.last_activity_at = new Date();

    await post.update(updates, { transaction });
    return post.reload({ transaction, include: buildPostInclude(['author']) });
  });
};

const deletePost = async (id, currentUser) => {
  const post = await Post.findByPk(id, { paranoid: false });
  if (!post) {
    throw new ApiError(404, 'Post not found', 'POST_NOT_FOUND');
  }

  if (post.user_id !== currentUser.id && !isAdmin(currentUser)) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }

  if (!post.deleted_at) {
    await post.destroy();
  }

  return { success: true };
};

const ensurePostExists = async (postId, currentUser, { includeDeleted = false } = {}) => {
  const post = await Post.findByPk(postId, { paranoid: !includeDeleted });
  if (!post) {
    throw new ApiError(404, 'Post not found', 'POST_NOT_FOUND');
  }
  if (post.deleted_at && !isAdmin(currentUser)) {
    throw new ApiError(404, 'Post not found', 'POST_NOT_FOUND');
  }
  return post;
};

const listComments = async (postId, query, currentUser) => {
  const includeDeleted = Boolean(query.includeDeleted);
  await ensurePostExists(postId, currentUser, { includeDeleted });

  const pagination = buildPagination(query, ['created_at']);
  const expand = normalizeArray(query.expand);

  const where = { post_id: postId };
  if (query.parent_id) {
    where.parent_id = query.parent_id;
  } else {
    where.parent_id = null;
  }

  if (pagination.cursorValue) {
    where[pagination.sortField] = {
      [pagination.cursorOperator]: pagination.cursorValue,
    };
  }

  const include = buildCommentInclude(expand);

  const comments = await Comment.findAll({
    where,
    include,
    order: pagination.order,
    limit: pagination.limit + 1,
    paranoid: !includeDeleted,
    distinct: true,
  });

  const hasMore = comments.length > pagination.limit;
  if (hasMore) {
    comments.pop();
  }

  const lastComment = comments[comments.length - 1];
  const nextCursor = hasMore && lastComment ? encodeCursor(lastComment.get(pagination.sortField)) : null;

  let analytics = null;
  if (query.analytics) {
    const [total, replies] = await Promise.all([
      Comment.count({ where: { post_id: postId }, paranoid: !includeDeleted }),
      Comment.count({ where: { post_id: postId, parent_id: { [Op.not]: null } }, paranoid: !includeDeleted }),
    ]);
    analytics = { total_comments: total, replies };
  }

  return {
    data: comments,
    meta: {
      limit: pagination.limit,
      next_cursor: nextCursor,
    },
    analytics,
  };
};

const createComment = async (userId, postId, payload) => {
  return sequelize.transaction(async (transaction) => {
    const post = await Post.findByPk(postId, { transaction });
    if (!post || post.deleted_at) {
      throw new ApiError(404, 'Post not found', 'POST_NOT_FOUND');
    }

    let parent = null;
    if (payload.parent_id) {
      parent = await Comment.findOne({
        where: { id: payload.parent_id, post_id: postId },
        transaction,
      });
      if (!parent) {
        throw new ApiError(400, 'Parent comment not found', 'PARENT_COMMENT_NOT_FOUND');
      }
    }

    const comment = await Comment.create(
      {
        user_id: userId,
        post_id: postId,
        content: payload.content,
        parent_id: payload.parent_id || null,
      },
      { transaction }
    );

    await refreshPostCounts(postId, { transaction, comments: true });
    await logPostActivity(postId, userId, 'comment', { comment_id: comment.id }, transaction);

    return comment.reload({
      include: buildCommentInclude([]),
      transaction,
    });
  });
};

const updateComment = async (id, currentUser, payload) => {
  const comment = await Comment.findByPk(id, { paranoid: false, include: [{ model: User, as: 'author' }] });
  if (!comment) {
    throw new ApiError(404, 'Comment not found', 'COMMENT_NOT_FOUND');
  }

  if (comment.deleted_at && !isAdmin(currentUser)) {
    throw new ApiError(404, 'Comment not found', 'COMMENT_NOT_FOUND');
  }

  if (comment.user_id !== currentUser.id && !isAdmin(currentUser)) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }

  if (payload.content !== undefined) {
    await comment.update({ content: payload.content });
  }

  return comment;
};

const deleteComment = async (id, currentUser) => {
  return sequelize.transaction(async (transaction) => {
    const comment = await Comment.findByPk(id, { transaction, paranoid: false });
    if (!comment) {
      throw new ApiError(404, 'Comment not found', 'COMMENT_NOT_FOUND');
    }

    if (comment.deleted_at) {
      return { success: true };
    }

    if (comment.user_id !== currentUser.id && !isAdmin(currentUser)) {
      throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
    }

    await comment.destroy({ transaction });
    await refreshPostCounts(comment.post_id, { transaction, comments: true });
    return { success: true };
  });
};

const addReaction = async (userId, postId, payload) => {
  return sequelize.transaction(async (transaction) => {
    const post = await Post.findByPk(postId, { transaction });
    if (!post || post.deleted_at) {
      throw new ApiError(404, 'Post not found', 'POST_NOT_FOUND');
    }

    const existing = await Reaction.findOne({
      where: { post_id: postId, user_id: userId },
      transaction,
      paranoid: false,
    });

    let reaction;
    if (!existing) {
      reaction = await Reaction.create(
        { post_id: postId, user_id: userId, type: payload.type },
        { transaction }
      );
    } else if (existing.deleted_at) {
      await existing.restore({ transaction });
      reaction = existing;
      reaction.type = payload.type;
      await reaction.save({ transaction });
    } else {
      reaction = existing;
      if (reaction.type !== payload.type) {
        reaction.type = payload.type;
        await reaction.save({ transaction });
      }
    }

    await refreshPostCounts(postId, { transaction, reactions: true });
    await logPostActivity(postId, userId, 'reaction', { reaction_type: payload.type }, transaction);

    return reaction.reload({
      include: [{ model: User, as: 'user', attributes: defaultUserAttributes }],
      transaction,
    });
  });
};

const removeReaction = async (userId, postId, payload = {}) => {
  return sequelize.transaction(async (transaction) => {
    const where = { post_id: postId, user_id: userId };
    if (payload.type) {
      where.type = payload.type;
    }

    const reaction = await Reaction.findOne({ where, transaction });
    if (!reaction) {
      return { success: true };
    }

    await reaction.destroy({ transaction });
    await refreshPostCounts(postId, { transaction, reactions: true });
    return { success: true };
  });
};

const listReactions = async (postId, query = {}) => {
  const post = await Post.findByPk(postId, { paranoid: false });
  if (!post) {
    throw new ApiError(404, 'Post not found', 'POST_NOT_FOUND');
  }

  if (query.grouped) {
    const rows = await Reaction.findAll({
      attributes: ['type', [fn('COUNT', col('Reaction.id')), 'count']],
      where: { post_id: postId },
      group: ['type'],
      order: [[fn('COUNT', col('Reaction.id')), 'DESC']],
      raw: true,
    });

    return {
      data: rows.map((row) => ({ type: row.type, count: Number(row.count) })),
    };
  }

  const reactions = await Reaction.findAll({
    where: { post_id: postId },
    include: [{ model: User, as: 'user', attributes: defaultUserAttributes }],
    order: [['created_at', 'DESC']],
  });

  return { data: reactions };
};

const sharePost = async (userId, postId, payload = {}) => {
  return sequelize.transaction(async (transaction) => {
    const post = await Post.findByPk(postId, { transaction });
    if (!post || post.deleted_at) {
      throw new ApiError(404, 'Post not found', 'POST_NOT_FOUND');
    }

    const share = await PostShare.create(
      {
        post_id: postId,
        user_id: userId,
        channel: payload.channel || null,
        message: payload.message || null,
        metadata: payload.metadata || null,
      },
      { transaction }
    );

    await refreshPostCounts(postId, { transaction, shares: true });
    await logPostActivity(postId, userId, 'share', { share_id: share.id, channel: share.channel }, transaction);

    return share.reload({
      include: [{ model: User, as: 'user', attributes: defaultUserAttributes }],
      transaction,
    });
  });
};

const parseWindow = (windowValue = '24h') => {
  const match = /^([0-9]+)([hdw])$/i.exec(String(windowValue));
  if (!match) {
    return { label: '24h', from: dayjs().subtract(24, 'hour').toDate() };
  }
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const unitMap = { h: 'hour', d: 'day', w: 'week' };
  const mappedUnit = unitMap[unit] || 'hour';
  return {
    label: `${amount}${unit}`,
    from: dayjs().subtract(amount, mappedUnit).toDate(),
  };
};

const getTrendingPosts = async (query = {}, currentUser) => {
  const { label, from } = parseWindow(query.window || '24h');
  const limit = Math.min(Number(query.limit) || 10, 50);
  const expand = normalizeArray(query.expand);
  const include = buildPostInclude(expand.length ? expand : ['author']);

  const scoreLiteral = literal(
    "SUM(CASE WHEN type = 'view' THEN 1 WHEN type = 'reaction' THEN 4 WHEN type = 'comment' THEN 6 WHEN type = 'share' THEN 8 ELSE 0 END)"
  );

  const rows = await PostActivity.findAll({
    attributes: [
      'post_id',
      [fn('SUM', literal("CASE WHEN type = 'view' THEN 1 ELSE 0 END")), 'views'],
      [fn('SUM', literal("CASE WHEN type = 'reaction' THEN 1 ELSE 0 END")), 'reactions'],
      [fn('SUM', literal("CASE WHEN type = 'comment' THEN 1 ELSE 0 END")), 'comments'],
      [fn('SUM', literal("CASE WHEN type = 'share' THEN 1 ELSE 0 END")), 'shares'],
      [scoreLiteral, 'score'],
    ],
    where: { created_at: { [Op.gte]: from } },
    group: ['post_id'],
    order: [[scoreLiteral, 'DESC']],
    limit,
    raw: true,
  });

  if (!rows.length) {
    return { window: label, data: [] };
  }

  const postIds = rows.map((row) => row.post_id);
  const posts = await Post.findAll({
    where: { id: { [Op.in]: postIds } },
    include,
    paranoid: !isAdmin(currentUser),
  });

  const postMap = new Map(posts.map((post) => [post.id, post]));
  const data = rows
    .map((row) => {
      const post = postMap.get(row.post_id);
      if (!post) {
        return null;
      }
      return {
        post,
        metrics: {
          views: Number(row.views || 0),
          reactions: Number(row.reactions || 0),
          comments: Number(row.comments || 0),
          shares: Number(row.shares || 0),
        },
        score: Number(row.score || 0),
      };
    })
    .filter(Boolean);

  return { window: label, data };
};

const getPostAnalytics = async (postId) => {
  const post = await Post.findByPk(postId, { paranoid: false });
  if (!post) {
    throw new ApiError(404, 'Post not found', 'POST_NOT_FOUND');
  }

  const { label, from } = parseWindow('24h');

  const [reactionsByType, recentActivities] = await Promise.all([
    Reaction.findAll({
      attributes: ['type', [fn('COUNT', col('Reaction.id')), 'count']],
      where: { post_id: postId },
      group: ['type'],
      raw: true,
    }),
    PostActivity.findAll({
      attributes: [
        'type',
        [fn('COUNT', col('PostActivity.id')), 'count'],
      ],
      where: { post_id: postId, created_at: { [Op.gte]: from } },
      group: ['type'],
      raw: true,
    }),
  ]);

  const reactions = reactionsByType.reduce((acc, item) => {
    acc[item.type] = Number(item.count || 0);
    return acc;
  }, {});

  const recent = recentActivities.reduce(
    (acc, item) => {
      const count = Number(item.count || 0);
      if (item.type === 'view') acc.views += count;
      if (item.type === 'reaction') acc.reactions += count;
      if (item.type === 'comment') acc.comments += count;
      if (item.type === 'share') acc.shares += count;
      return acc;
    },
    { views: 0, reactions: 0, comments: 0, shares: 0 }
  );

  const reach = Math.max(post.unique_view_count, post.reaction_count + post.comment_count + post.share_count);

  return {
    post_id: post.id,
    totals: {
      views: post.view_count,
      unique_views: post.unique_view_count,
      reactions: post.reaction_count,
      comments: post.comment_count,
      shares: post.share_count,
      reach,
    },
    reactions_by_type: reactions,
    recent: {
      window: label,
      ...recent,
    },
    updated_at: post.updated_at,
  };
};

const getFeedHealth = async ({ from, to } = {}) => {
  const fromDate = from ? dayjs(from).toDate() : dayjs().subtract(7, 'day').toDate();
  const toDate = to ? dayjs(to).toDate() : new Date();

  const metrics = await FeedMetric.findAll({
    where: {
      created_at: {
        [Op.between]: [fromDate, toDate],
      },
    },
    raw: true,
  });

  if (!metrics.length) {
    return {
      window: { from: fromDate, to: toDate },
      totals: { requests: 0, errors: 0 },
      latency: { avg_ms: 0, p95_ms: 0, max_ms: 0, min_ms: 0 },
      error_rate: 0,
      feeds: {},
    };
  }

  const totals = {
    requests: metrics.length,
    errors: metrics.filter((item) => item.error).length,
  };

  const latencies = metrics
    .map((item) => item.latency_ms)
    .sort((a, b) => a - b);
  const avgLatency = latencies.reduce((sum, value) => sum + value, 0) / latencies.length;
  const p95Index = Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95));

  const feeds = metrics.reduce((acc, metric) => {
    const feedKey = metric.feed || 'unknown';
    if (!acc[feedKey]) {
      acc[feedKey] = { requests: 0, errors: 0, latencies: [] };
    }
    acc[feedKey].requests += 1;
    if (metric.error) acc[feedKey].errors += 1;
    acc[feedKey].latencies.push(metric.latency_ms);
    return acc;
  }, {});

  const feedAnalytics = Object.fromEntries(
    Object.entries(feeds).map(([feedKey, value]) => {
      const sorted = value.latencies.sort((a, b) => a - b);
      const avg = sorted.reduce((sum, l) => sum + l, 0) / sorted.length;
      const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
      return [
        feedKey,
        {
          requests: value.requests,
          errors: value.errors,
          error_rate: value.requests ? Number((value.errors / value.requests).toFixed(4)) : 0,
          avg_latency_ms: Number(avg.toFixed(2)),
          p95_latency_ms: p95 || 0,
        },
      ];
    })
  );

  return {
    window: { from: fromDate, to: toDate },
    totals,
    latency: {
      avg_ms: Number(avgLatency.toFixed(2)),
      p95_ms: latencies[p95Index] || 0,
      max_ms: latencies[latencies.length - 1] || 0,
      min_ms: latencies[0] || 0,
    },
    error_rate: Number((totals.errors / totals.requests).toFixed(4)),
    feeds: feedAnalytics,
  };
};

const recordFeedMetric = async ({ feed = 'home', userId = null, latencyMs = 0, error = false, statusCode, errorCode, metadata }) => {
  try {
    await FeedMetric.create({
      feed,
      user_id: userId || null,
      latency_ms: Math.max(0, Math.round(latencyMs)),
      error,
      status_code: statusCode || null,
      error_code: errorCode || null,
      metadata: metadata && Object.keys(metadata).length ? metadata : null,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Failed to record feed metric', err);
  }
};

module.exports = {
  listPosts,
  createPost,
  getPost,
  updatePost,
  deletePost,
  listComments,
  createComment,
  updateComment,
  deleteComment,
  addReaction,
  removeReaction,
  listReactions,
  sharePost,
  getTrendingPosts,
  getPostAnalytics,
  getFeedHealth,
  recordFeedMetric,
};
