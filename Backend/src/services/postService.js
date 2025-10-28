const { Post, Comment, Reaction, User, sequelize } = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { buildPagination } = require('../utils/pagination');

const listPosts = async (query) => {
  const pagination = buildPagination(query);
  const where = {};
  if (query.author_id) where.user_id = query.author_id;
  if (query.org_id) where.org_id = query.org_id;
  const include = [{ model: User, as: 'author' }];
  const { rows, count } = await Post.findAndCountAll({
    where,
    include,
    limit: pagination.limit,
    order: pagination.order,
  });
  let analytics;
  if (query.analytics === 'true') {
    analytics = await sequelize.query(
      'SELECT COUNT(*)::int as total_posts FROM posts',
      { type: sequelize.QueryTypes.SELECT }
    );
  }
  return { data: rows, total: count, analytics: analytics?.[0] };
};

const createPost = (userId, body) =>
  Post.create({
    user_id: userId,
    content: body.content,
    attachments: body.attachments,
    share_ref: body.share_ref,
  });

const getPost = async (id) => {
  const post = await Post.findByPk(id, { include: [{ model: Comment, as: 'comments' }] });
  if (!post) throw new ApiError(404, 'Post not found', 'POST_NOT_FOUND');
  return post;
};

const updatePost = async (id, userId, body) => {
  const post = await Post.findByPk(id);
  if (!post || post.user_id !== userId) throw new ApiError(404, 'Post not found', 'POST_NOT_FOUND');
  await post.update(body);
  return post;
};

const deletePost = async (id, user) => {
  const post = await Post.findByPk(id);
  if (!post) throw new ApiError(404, 'Post not found', 'POST_NOT_FOUND');
  if (post.user_id !== user.id && user.role !== 'admin') {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }
  await post.destroy();
  return { success: true };
};

const createComment = async (userId, postId, body) => {
  const post = await Post.findByPk(postId);
  if (!post) throw new ApiError(404, 'Post not found', 'POST_NOT_FOUND');
  return Comment.create({ user_id: userId, post_id: postId, content: body.content, parent_id: body.parent_id });
};

const react = async (userId, postId, body) => {
  const post = await Post.findByPk(postId);
  if (!post) throw new ApiError(404, 'Post not found', 'POST_NOT_FOUND');
  const [reaction] = await Reaction.findOrCreate({ where: { user_id: userId, post_id: postId }, defaults: { type: body.type } });
  if (!reaction.isNewRecord) {
    reaction.type = body.type;
    await reaction.save();
  }
  return reaction;
};

const removeReaction = async (userId, postId) => {
  await Reaction.destroy({ where: { user_id: userId, post_id: postId } });
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
