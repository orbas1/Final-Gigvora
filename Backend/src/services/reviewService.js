const { Op, fn, col } = require('sequelize');
const {
  Review,
  Profile,
  Job,
  EscrowIntent,
  Wallet,
  JobApplication,
  Connection,
  sequelize,
} = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { buildPagination, encodeCursor } = require('../utils/pagination');

const SUBJECT_TYPES = ['profile', 'project', 'order'];
const SELECTABLE_FIELDS = new Set([
  'id',
  'subject_type',
  'subject_id',
  'reviewer_id',
  'rating',
  'comment',
  'metadata',
  'created_at',
  'updated_at',
  'deleted_at',
]);

const parseListParam = (value) => {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const likeOperator = () => (sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like);

const normalizeSubjectType = (value) => {
  if (!value) return null;
  const normalized = String(value).toLowerCase();
  return SUBJECT_TYPES.includes(normalized) ? normalized : null;
};

const ensureReviewer = (actor, payloadReviewerId) => {
  if (!actor) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }
  if (actor.role === 'admin' && payloadReviewerId) {
    return payloadReviewerId;
  }
  if (!actor.id) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }
  if (payloadReviewerId && payloadReviewerId !== actor.id) {
    throw new ApiError(403, 'Reviewer mismatch', 'FORBIDDEN');
  }
  return actor.id;
};

const ensureSubject = async (type, id, { includeDeleted = false } = {}) => {
  switch (type) {
    case 'profile': {
      const profile = await Profile.findByPk(id, { paranoid: !includeDeleted });
      if (!profile) {
        throw new ApiError(404, 'Profile not found', 'PROFILE_NOT_FOUND');
      }
      return { record: profile, ownerIds: new Set([profile.user_id].filter(Boolean)) };
    }
    case 'project': {
      const job = await Job.findByPk(id, { paranoid: !includeDeleted });
      if (!job) {
        throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
      }
      return { record: job, ownerIds: new Set([job.posted_by].filter(Boolean)) };
    }
    case 'order': {
      const escrow = await EscrowIntent.findByPk(id, {
        paranoid: !includeDeleted,
        include: [
          { model: Wallet, as: 'payerWallet', attributes: ['id', 'user_id'], paranoid: false, required: false },
          { model: Wallet, as: 'payeeWallet', attributes: ['id', 'user_id'], paranoid: false, required: false },
        ],
      });
      if (!escrow) {
        throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
      }
      const ownerIds = new Set(
        [escrow.payerWallet?.user_id, escrow.payeeWallet?.user_id].filter(Boolean)
      );
      return { record: escrow, ownerIds };
    }
    default:
      throw new ApiError(400, 'Unsupported subject type', 'UNSUPPORTED_SUBJECT');
  }
};

const hasAcceptedConnection = async (userId, targetUserId) => {
  if (!userId || !targetUserId) return false;
  const connection = await Connection.findOne({
    where: {
      status: 'accepted',
      [Op.or]: [
        { requester_id: userId, addressee_id: targetUserId },
        { requester_id: targetUserId, addressee_id: userId },
      ],
    },
  });
  return Boolean(connection);
};

const ensureCreatePolicy = async (type, { subject, reviewerId, actor }) => {
  if (actor?.role === 'admin') {
    return;
  }

  switch (type) {
    case 'profile': {
      const profileOwner = subject.record.user_id;
      if (profileOwner === reviewerId) {
        throw new ApiError(422, 'You cannot review your own profile', 'REVIEW_NOT_ALLOWED');
      }
      const connected = await hasAcceptedConnection(reviewerId, profileOwner);
      if (!connected) {
        throw new ApiError(422, 'Review not allowed without an accepted engagement', 'REVIEW_NOT_ALLOWED');
      }
      return;
    }
    case 'project': {
      if (subject.record.posted_by === reviewerId) {
        return;
      }
      const application = await JobApplication.findOne({
        where: { job_id: subject.record.id, candidate_id: reviewerId },
        paranoid: false,
      });
      if (!application) {
        throw new ApiError(422, 'Project reviews require an application or ownership', 'REVIEW_NOT_ALLOWED');
      }
      return;
    }
    case 'order': {
      const allowed = subject.ownerIds.has(reviewerId);
      if (!allowed) {
        throw new ApiError(422, 'Order reviews require participation', 'REVIEW_NOT_ALLOWED');
      }
      return;
    }
    default:
      throw new ApiError(400, 'Unsupported subject type', 'UNSUPPORTED_SUBJECT');
  }
};

const serializeSubject = (reviewJson) => {
  switch (reviewJson.subject_type) {
    case 'profile':
      if (reviewJson.profileSubject) {
        return {
          id: reviewJson.profileSubject.id,
          user_id: reviewJson.profileSubject.user_id,
          display_name: reviewJson.profileSubject.display_name,
        };
      }
      break;
    case 'project':
      if (reviewJson.projectSubject) {
        return {
          id: reviewJson.projectSubject.id,
          title: reviewJson.projectSubject.title,
          posted_by: reviewJson.projectSubject.posted_by,
          status: reviewJson.projectSubject.status,
        };
      }
      break;
    case 'order':
      if (reviewJson.orderSubject) {
        return {
          id: reviewJson.orderSubject.id,
          reference_type: reviewJson.orderSubject.reference_type,
          reference_id: reviewJson.orderSubject.reference_id,
          status: reviewJson.orderSubject.status,
        };
      }
      break;
    default:
      break;
  }
  return null;
};

const serializeReview = (review) => {
  const json = typeof review.toJSON === 'function' ? review.toJSON() : review;
  let metadata = json.metadata;
  if (metadata && typeof metadata === 'string') {
    try {
      metadata = JSON.parse(metadata);
    } catch (error) {
      // keep string form when JSON parsing fails
    }
  }
  const base = {
    id: json.id,
    subject_type: json.subject_type,
    subject_id: json.subject_id,
    reviewer_id: json.reviewer_id,
    rating: json.rating,
    comment: json.comment,
    metadata,
    created_at: json.created_at,
    updated_at: json.updated_at,
  };
  if (json.deleted_at) {
    base.deleted_at = json.deleted_at;
  }
  if (json.reviewer) {
    base.reviewer = {
      id: json.reviewer.id,
      email: json.reviewer.email,
      role: json.reviewer.role,
      first_name: json.reviewer.first_name || null,
      last_name: json.reviewer.last_name || null,
    };
  }
  const subject = serializeSubject(json);
  if (subject) {
    base.subject = subject;
  }
  return base;
};

const duplicateReviewExists = async ({ subject_type, subject_id, reviewer_id }) => {
  const existing = await Review.findOne({
    where: { subject_type, subject_id, reviewer_id },
    paranoid: false,
  });
  if (!existing) {
    return false;
  }
  if (existing.deleted_at) {
    throw new ApiError(409, 'A review exists but is deleted. Restore it instead of recreating.', 'REVIEW_SOFT_DELETED');
  }
  return true;
};

const create = async (payload, actor) => {
  const subjectType = normalizeSubjectType(payload.subject_type);
  if (!subjectType) {
    throw new ApiError(400, 'Invalid subject type', 'INVALID_SUBJECT_TYPE');
  }
  if (!payload.subject_id) {
    throw new ApiError(400, 'subject_id is required', 'VALIDATION_ERROR');
  }
  if (payload.rating < 1 || payload.rating > 5) {
    throw new ApiError(400, 'Rating must be between 1 and 5', 'INVALID_RATING');
  }

  const reviewerId = ensureReviewer(actor, payload.reviewer_id);
  const subject = await ensureSubject(subjectType, payload.subject_id);
  await ensureCreatePolicy(subjectType, { subject, reviewerId, actor });

  const exists = await duplicateReviewExists({
    subject_type: subjectType,
    subject_id: subject.record.id,
    reviewer_id: reviewerId,
  });
  if (exists) {
    throw new ApiError(409, 'You have already reviewed this subject', 'REVIEW_EXISTS');
  }

  const review = await Review.create({
    subject_type: subjectType,
    subject_id: subject.record.id,
    reviewer_id: reviewerId,
    rating: payload.rating,
    comment: payload.comment,
    metadata: payload.metadata || null,
  });

  await review.reload({
    include: [
      { association: 'reviewer', attributes: ['id', 'email', 'role', 'first_name', 'last_name'], required: false },
    ],
  });

  return serializeReview(review);
};

const buildListWhere = (query, currentUser) => {
  const subjectType = normalizeSubjectType(query.subject_type);
  const where = {};
  if (subjectType) {
    where.subject_type = subjectType;
  }
  if (query.subject_id) {
    where.subject_id = query.subject_id;
  }
  if (query.reviewer_id) {
    where.reviewer_id = query.reviewer_id;
  }
  if (query.q) {
    where.comment = { [likeOperator()]: `%${query.q}%` };
  }
  if (query.min_rating || query.max_rating) {
    const range = {};
    if (query.min_rating) {
      range[Op.gte] = Number(query.min_rating);
    }
    if (query.max_rating) {
      range[Op.lte] = Number(query.max_rating);
    }
    where.rating = { ...(where.rating || {}), ...range };
  }
  return { where, subjectType };
};

const buildIncludes = (expand, subjectType) => {
  const include = [];
  if (expand.has('reviewer')) {
    include.push({
      association: 'reviewer',
      attributes: ['id', 'email', 'role', 'first_name', 'last_name'],
      required: false,
    });
  }
  if (expand.has('subject')) {
    const subjectIncludes = [];
    if (!subjectType || subjectType === 'profile') {
      subjectIncludes.push({ association: 'profileSubject', required: false, paranoid: false });
    }
    if (!subjectType || subjectType === 'project') {
      subjectIncludes.push({ association: 'projectSubject', required: false, paranoid: false });
    }
    if (!subjectType || subjectType === 'order') {
      subjectIncludes.push({ association: 'orderSubject', required: false, paranoid: false });
    }
    include.push(...subjectIncludes);
  }
  return include;
};

const computeAnalytics = async (where, paranoid) => {
  const [aggregate] = await Review.findAll({
    where,
    paranoid,
    attributes: [[fn('COUNT', col('*')), 'review_count'], [fn('AVG', col('rating')), 'average_rating']],
    raw: true,
  });
  const breakdownRows = await Review.findAll({
    where,
    paranoid,
    attributes: ['rating', [fn('COUNT', col('*')), 'count']],
    group: ['rating'],
    raw: true,
  });
  const rating_breakdown = breakdownRows.reduce((acc, row) => {
    acc[row.rating] = Number(row.count || 0);
    return acc;
  }, {});
  return {
    review_count: Number(aggregate?.review_count || 0),
    average_rating: aggregate?.average_rating ? Number(Number(aggregate.average_rating).toFixed(2)) : 0,
    rating_breakdown,
  };
};

const list = async (query, currentUser) => {
  const pagination = buildPagination(query, ['created_at', 'rating']);
  const expand = new Set(parseListParam(query.expand));
  const fields = parseListParam(query.fields).filter((field) => SELECTABLE_FIELDS.has(field));
  const includes = new Set(parseListParam(query.include));

  const includeDeleted = includes.has('deleted') && currentUser?.role === 'admin';
  const { where, subjectType } = buildListWhere(query, currentUser);

  const listWhere = { ...where };
  if (pagination.cursorValue !== undefined && pagination.cursorValue !== null) {
    listWhere[pagination.sortField] = {
      ...(listWhere[pagination.sortField] || {}),
      [pagination.cursorOperator]: pagination.cursorValue,
    };
  }

  const include = buildIncludes(expand, subjectType);
  const attributes = fields.length
    ? Array.from(new Set([...fields, 'id', pagination.sortField]))
    : undefined;

  const rows = await Review.findAll({
    where: listWhere,
    attributes,
    include,
    paranoid: !includeDeleted,
    order: pagination.order,
    limit: pagination.limit + 1,
    distinct: true,
  });

  const hasMore = rows.length > pagination.limit;
  const sliced = hasMore ? rows.slice(0, pagination.limit) : rows;
  const data = sliced.map(serializeReview);
  let nextCursorValue;
  if (hasMore) {
    const last = sliced[sliced.length - 1];
    if (last) {
      nextCursorValue = typeof last.get === 'function' ? last.get(pagination.sortField) : last[pagination.sortField];
    }
  }

  let analytics;
  if (query.analytics === 'true') {
    analytics = await computeAnalytics(where, !includeDeleted);
  }

  return {
    data,
    page: {
      next_cursor: hasMore ? encodeCursor(nextCursorValue) : null,
      limit: pagination.limit,
    },
    analytics,
  };
};

const canManageReview = (review, actor, subjectOwners) => {
  if (!actor) return false;
  if (actor.role === 'admin') return true;
  if (review.reviewer_id === actor.id) return true;
  if (subjectOwners.has(actor.id)) return true;
  return false;
};

const remove = async (id, actor) => {
  if (!actor) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }
  const review = await Review.findByPk(id, { paranoid: false });
  if (!review) {
    throw new ApiError(404, 'Review not found', 'REVIEW_NOT_FOUND');
  }

  const subject = await ensureSubject(review.subject_type, review.subject_id, { includeDeleted: true });

  if (!canManageReview(review, actor, subject.ownerIds)) {
    throw new ApiError(403, 'You are not allowed to manage this review', 'FORBIDDEN');
  }

  if (review.deleted_at) {
    return { success: true, already_deleted: true };
  }

  await review.destroy();
  return { success: true };
};

const analyticsAverages = async (query, currentUser) => {
  const subjectType = normalizeSubjectType(query.subject_type);
  if (!subjectType) {
    throw new ApiError(400, 'subject_type is required', 'VALIDATION_ERROR');
  }
  if (!query.subject_id) {
    throw new ApiError(400, 'subject_id is required', 'VALIDATION_ERROR');
  }

  const includes = new Set(parseListParam(query.include));
  const includeDeleted = includes.has('deleted') && currentUser?.role === 'admin';

  await ensureSubject(subjectType, query.subject_id, { includeDeleted });

  const where = { subject_type: subjectType, subject_id: query.subject_id };
  const analytics = await computeAnalytics(where, !includeDeleted);

  return { data: analytics };
};

module.exports = {
  create,
  list,
  remove,
  analyticsAverages,
  SUBJECT_TYPES,
};
