const { Op, fn, col } = require('sequelize');
const { Review, Profile, User, sequelize } = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { buildPagination, encodeCursor } = require('../utils/pagination');

const SUBJECT_TYPES = Review.subjectTypes || ['project', 'order', 'profile'];

const normalizeSubjectType = (value) => {
  if (!value) return null;
  return String(value).toLowerCase();
};

const isAnalyticsRequested = (value) => {
  if (value === undefined || value === null) return false;
  const normalized = String(value).toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

const ensureSubjectType = (subjectType) => {
  const normalized = normalizeSubjectType(subjectType);
  if (!normalized || !SUBJECT_TYPES.includes(normalized)) {
    throw new ApiError(400, 'Invalid subject type', 'INVALID_SUBJECT_TYPE');
  }
  return normalized;
};

const loadReviewer = async (reviewer) => {
  if (!reviewer) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }
  if (reviewer instanceof User) {
    return reviewer;
  }
  if (typeof reviewer === 'string') {
    const user = await User.findByPk(reviewer);
    if (!user) {
      throw new ApiError(404, 'Reviewer not found', 'REVIEWER_NOT_FOUND');
    }
    return user;
  }
  if (reviewer?.id) {
    const user = await User.findByPk(reviewer.id);
    if (!user) {
      throw new ApiError(404, 'Reviewer not found', 'REVIEWER_NOT_FOUND');
    }
    return user;
  }
  throw new ApiError(404, 'Reviewer not found', 'REVIEWER_NOT_FOUND');
};

const assertProfileSubject = async (subjectId, reviewer) => {
  const profile = await Profile.findByPk(subjectId);
  if (!profile) {
    throw new ApiError(404, 'Profile not found', 'PROFILE_NOT_FOUND');
  }
  if (profile.user_id === reviewer.id) {
    throw new ApiError(400, 'You cannot review your own profile', 'SELF_REVIEW_NOT_ALLOWED');
  }
  return profile;
};

const createReview = async ({ subject_type, subject_id, rating, comment }, reviewerInput) => {
  const reviewer = await loadReviewer(reviewerInput);
  const normalizedType = ensureSubjectType(subject_type);

  if (!subject_id) {
    throw new ApiError(400, 'subject_id is required', 'VALIDATION_ERROR');
  }

  let profileId = null;
  if (normalizedType === 'profile') {
    const profile = await assertProfileSubject(subject_id, reviewer);
    profileId = profile.id;
  }

  return sequelize.transaction(async (transaction) => {
    const lockOptions = transaction.LOCK && transaction.LOCK.UPDATE ? { lock: transaction.LOCK.UPDATE } : {};
    const existing = await Review.findOne({
      where: {
        subject_type: normalizedType,
        subject_id,
        reviewer_id: reviewer.id,
      },
      transaction,
      ...lockOptions,
    });

    if (existing) {
      throw new ApiError(409, 'You have already submitted a review for this subject', 'REVIEW_ALREADY_EXISTS');
    }

    const review = await Review.create(
      {
        subject_type: normalizedType,
        subject_id,
        profile_id: profileId,
        reviewer_id: reviewer.id,
        rating,
        comment,
      },
      { transaction }
    );

    await review.reload({ include: [{ model: User, as: 'reviewer' }], transaction });
    return review.toJSON();
  });
};

const parseFields = (fields) => {
  if (!fields) return undefined;
  const items = String(fields)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (!items.length) return undefined;
  if (!items.includes('id')) {
    items.push('id');
  }
  return items;
};

const parseExpand = (expand) => {
  if (!expand) return new Set();
  const parts = String(expand)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set(parts);
};

const listReviews = async (query = {}, currentUser = null) => {
  const normalizedType = query.subject_type ? ensureSubjectType(query.subject_type) : null;
  const includeDeleted = query.include === 'deleted' && currentUser?.role === 'admin';
  const paranoid = !includeDeleted;
  const pagination = buildPagination(query, ['created_at', 'rating']);

  const filters = {};
  if (normalizedType) filters.subject_type = normalizedType;
  if (query.subject_id) filters.subject_id = query.subject_id;
  if (query.reviewer_id) filters.reviewer_id = query.reviewer_id;
  if (query.q) {
    filters.comment = { [Op.substring]: query.q };
  }

  const where = { ...filters };
  if (pagination.cursorValue !== undefined && pagination.cursorValue !== null) {
    where[pagination.sortField] = { [pagination.cursorOperator]: pagination.cursorValue };
  }

  const expand = parseExpand(query.expand);
  const include = [];
  if (expand.has('reviewer')) {
    include.push({ model: User, as: 'reviewer' });
  }
  if (expand.has('profile') || expand.has('subject')) {
    include.push({ model: Profile, as: 'profile' });
  }

  let attributes = parseFields(query.fields);
  if (attributes && !attributes.includes(pagination.sortField)) {
    attributes = Array.from(new Set([...attributes, pagination.sortField]));
  }

  const rows = await Review.findAll({
    where,
    limit: pagination.limit + 1,
    order: pagination.order,
    paranoid,
    include,
    attributes,
  });

  let nextCursor = null;
  if (rows.length > pagination.limit) {
    const next = rows.pop();
    nextCursor = encodeCursor(next[pagination.sortField]);
  }

  const data = rows.map((row) => row.toJSON());
  const total = await Review.count({ where: filters, paranoid });

  let analytics;
  if (isAnalyticsRequested(query.analytics)) {
    const sum = await Review.sum('rating', { where: filters, paranoid });
    const breakdown = await Review.findAll({
      where: filters,
      paranoid,
      attributes: ['rating', [fn('COUNT', col('id')), 'count']],
      group: ['rating'],
      order: [['rating', 'ASC']],
      raw: true,
    });
    const mappedBreakdown = [1, 2, 3, 4, 5].map((rating) => ({
      rating,
      count:
        Number(
          breakdown.find((row) => Number(row.rating) === rating)?.count || 0
        ),
    }));
    const average = total ? Number((Number(sum || 0) / total).toFixed(2)) : 0;
    analytics = {
      total_reviews: total,
      average_rating: average,
      rating_breakdown: mappedBreakdown,
    };
  }

  return {
    data,
    meta: {
      total,
      limit: pagination.limit,
      sort: {
        field: pagination.sortField,
        direction: pagination.sortDirection,
      },
      next_cursor: nextCursor,
      ...(analytics ? { analytics } : {}),
    },
  };
};

const deleteReview = async (id, actor) => {
  if (!actor) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  const review = await Review.findByPk(id, {
    include: [{ model: Profile, as: 'profile', paranoid: false }],
  });

  if (!review) {
    throw new ApiError(404, 'Review not found', 'REVIEW_NOT_FOUND');
  }

  const isReviewer = review.reviewer_id === actor.id;
  const isAdmin = actor.role === 'admin';
  const isSubjectOwner =
    review.subject_type === 'profile' && review.profile?.user_id
      ? review.profile.user_id === actor.id
      : false;

  if (!isReviewer && !isAdmin && !isSubjectOwner) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }

  await review.destroy();
  return { success: true };
};

const averagesAnalytics = async ({ subject_type, subject_id, include }, actor) => {
  if (!subject_type || !subject_id) {
    throw new ApiError(400, 'subject_type and subject_id are required', 'VALIDATION_ERROR');
  }

  const normalizedType = ensureSubjectType(subject_type);
  const includeDeleted = include === 'deleted' && actor?.role === 'admin';
  const paranoid = !includeDeleted;

  const where = { subject_type: normalizedType, subject_id };

  const total = await Review.count({ where, paranoid });
  const sum = await Review.sum('rating', { where, paranoid });
  const breakdownRows = await Review.findAll({
    where,
    paranoid,
    attributes: ['rating', [fn('COUNT', col('id')), 'count']],
    group: ['rating'],
    order: [['rating', 'ASC']],
    raw: true,
  });

  const breakdown = [1, 2, 3, 4, 5].map((rating) => ({
    rating,
    count: Number(breakdownRows.find((row) => Number(row.rating) === rating)?.count || 0),
  }));

  return {
    subject_type: normalizedType,
    subject_id,
    total_reviews: total,
    average_rating: total ? Number((Number(sum || 0) / total).toFixed(2)) : 0,
    rating_breakdown: breakdown,
  };
};

module.exports = {
  SUBJECT_TYPES,
  createReview,
  listReviews,
  deleteReview,
  averagesAnalytics,
};
