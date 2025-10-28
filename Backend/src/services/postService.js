const dayjs = require('dayjs');
const { Op } = require('sequelize');
const { Post, Comment, Reaction, User, Group, GroupMember } = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { buildPagination, encodeCursor } = require('../utils/pagination');

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const ensureGroupAccess = async (groupId, user, { requireMembership = false } = {}) => {
  if (!groupId) {
    return { group: null, membership: null };
  }
  const group = await Group.findByPk(groupId);
  if (!group) {
    throw new ApiError(404, 'Group not found', 'GROUP_NOT_FOUND');
  }
  let membership = null;
  if (user) {
    membership = await GroupMember.findOne({ where: { group_id: group.id, user_id: user.id } });
  }
  if (group.visibility === 'private' && user?.role !== 'admin' && !membership) {
    throw new ApiError(403, 'Group content is private', 'GROUP_PRIVATE');
  }
  if (requireMembership && user?.role !== 'admin' && !membership) {
    throw new ApiError(403, 'You must be a group member to perform this action', 'MEMBERSHIP_REQUIRED');
  }
  return { group, membership };
};

const listPosts = async (query, currentUser) => {
  const pagination = buildPagination(query, ['created_at', 'updated_at']);
  const expand = new Set(toArray(query.expand));
  const requestedFields = toArray(query.fields);

  const where = {};
  if (query.author_id) where.user_id = query.author_id;
  if (query.org_id) where.org_id = query.org_id;
  if (query.group_id) {
    await ensureGroupAccess(query.group_id, currentUser);
    where.group_id = query.group_id;
  }
  if (pagination.cursorValue !== undefined) {
    where[pagination.sortField] = {
      ...(where[pagination.sortField] || {}),
      [pagination.cursorOperator]: pagination.cursorValue,
    };
  }

  const include = [{ model: User, as: 'author', attributes: ['id', 'email'] }];
  if (expand.has('group')) {
    include.push({ model: Group, as: 'group', attributes: ['id', 'name', 'slug'] });
  }
  if (expand.has('comments')) {
    include.push({ model: Comment, as: 'comments' });
  }

  const attributes = requestedFields.length
    ? Array.from(new Set([...requestedFields, 'id', pagination.sortField]))
    : undefined;

  const { rows, count } = await Post.findAndCountAll({
    where,
    include,
    attributes,
    limit: pagination.limit + 1,
    order: pagination.order,
    distinct: true,
    col: 'Post.id',
    subQuery: false,
  });

  const hasMore = rows.length > pagination.limit;
  const dataRows = hasMore ? rows.slice(0, pagination.limit) : rows;
  const data = dataRows.map((row) => row.toJSON());
  const nextCursorValue = hasMore ? data[data.length - 1]?.[pagination.sortField] : undefined;
  const nextCursor = hasMore ? encodeCursor(nextCursorValue) : null;

  let analytics;
  if (query.analytics === true) {
    const baseWhere = { ...where };
    delete baseWhere[pagination.sortField];
    const [totalPosts, postsLast30] = await Promise.all([
      Post.count({ where: baseWhere }),
      Post.count({
        where: {
          ...baseWhere,
          created_at: { [Op.gte]: dayjs().subtract(30, 'day').toDate() },
        },
      }),
    ]);
    analytics = { total_posts: totalPosts, posts_last_30_days: postsLast30 };
  }

  return {
    data,
    total: typeof count === 'number' ? count : count.length,
    page: {
      limit: pagination.limit,
      next_cursor: nextCursor,
    },
    analytics,
  };
};

const createPost = async (user, body) => {
  if (!user) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }
  let groupId = null;
  if (body.group_id) {
    await ensureGroupAccess(body.group_id, user, { requireMembership: true });
    groupId = body.group_id;
  }
  return Post.create({
    user_id: user.id,
    content: body.content,
    attachments: body.attachments,
    share_ref: body.share_ref,
    group_id: groupId,
  });
};

const getPost = async (id, currentUser) => {
  const post = await Post.findByPk(id, {
    include: [
      { model: Comment, as: 'comments' },
      { model: User, as: 'author', attributes: ['id', 'email'] },
      { model: Group, as: 'group', attributes: ['id', 'name', 'slug'] },
    ],
  });
  if (!post) throw new ApiError(404, 'Post not found', 'POST_NOT_FOUND');
  if (post.group_id) {
    await ensureGroupAccess(post.group_id, currentUser);
  }
  return post;
};

const updatePost = async (id, user, body) => {
  if (!user) throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  const post = await Post.findByPk(id);
  if (!post || post.user_id !== user.id) throw new ApiError(404, 'Post not found', 'POST_NOT_FOUND');
  if (post.group_id) {
    await ensureGroupAccess(post.group_id, user, { requireMembership: true });
  }
  if (body.group_id && body.group_id !== post.group_id) {
    throw new ApiError(400, 'Changing the post group is not supported', 'GROUP_IMMUTABLE');
  }
  await post.update({
    content: body.content,
    attachments: body.attachments,
    share_ref: body.share_ref,
  });
  return post;
};

const deletePost = async (id, user) => {
  if (!user) throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  const post = await Post.findByPk(id);
  if (!post) throw new ApiError(404, 'Post not found', 'POST_NOT_FOUND');
  if (post.user_id !== user.id && user.role !== 'admin') {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }
  if (post.group_id) {
    await ensureGroupAccess(post.group_id, user);
  }
  await post.destroy();
  return { success: true };
};

const createComment = async (user, postId, body) => {
  if (!user) throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  const post = await Post.findByPk(postId);
  if (!post) throw new ApiError(404, 'Post not found', 'POST_NOT_FOUND');
  if (post.group_id) {
    await ensureGroupAccess(post.group_id, user, { requireMembership: true });
  }
  return Comment.create({ user_id: user.id, post_id: postId, content: body.content, parent_id: body.parent_id });
};

const react = async (user, postId, body) => {
  if (!user) throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  const post = await Post.findByPk(postId);
  if (!post) throw new ApiError(404, 'Post not found', 'POST_NOT_FOUND');
  if (post.group_id) {
    await ensureGroupAccess(post.group_id, user, { requireMembership: true });
  }
  const [reaction, created] = await Reaction.findOrCreate({
    where: { user_id: user.id, post_id: postId },
    defaults: { type: body.type },
  });
  if (!created) {
    reaction.type = body.type;
    await reaction.save();
  }
  return reaction;
};

const removeReaction = async (user, postId) => {
  if (!user) throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  const post = await Post.findByPk(postId);
  if (!post) throw new ApiError(404, 'Post not found', 'POST_NOT_FOUND');
  if (post.group_id) {
    await ensureGroupAccess(post.group_id, user, { requireMembership: true });
  }
  await Reaction.destroy({ where: { user_id: user.id, post_id: postId } });
  return { success: true };
};

module.exports = {
  listPosts,
  createPost,
  getPost,
  updatePost,
  deletePost,
  createComment,
  react,
  removeReaction,
};
