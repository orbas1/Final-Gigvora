const { Op, fn, col, literal } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const {
  sequelize,
  Suggestion,
  SuggestionEvent,
  DiscoverEntity,
  Post,
  Reaction,
  Comment,
  Profile,
  Skill,
  User,
  UserFollow,
  Review,
} = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { buildPagination, encodeCursor } = require('../utils/pagination');

const SURFACES = Suggestion.SURFACES;
const EVENT_TYPES = SuggestionEvent.EVENT_TYPES || ['impression', 'click', 'dismiss', 'save'];
const SURFACE_LABELS = {
  feed: 'story',
  people: 'profile',
  groups: 'group',
  companies: 'company',
  projects: 'project',
  gigs: 'gig',
  jobs: 'job',
};

const queryGenerator = sequelize.getQueryInterface().queryGenerator;
const quoteTable = (input) => queryGenerator.quoteTable(input);
const quoteIdentifier = (column) => queryGenerator.quoteIdentifier(column);
const getTableName = (model) => {
  const table = model.getTableName();
  return typeof table === 'string' ? table : table.tableName;
};

const normalizeArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const normaliseSearchTerms = (...parts) =>
  parts
    .flat()
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())
    .join(' ');

const likeOperator = () => (sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like);

const ensureSurface = (surface) => {
  if (!SURFACES.includes(surface)) {
    throw new ApiError(400, `Unsupported suggestions surface: ${surface}`, 'UNSUPPORTED_SURFACE');
  }
};

const persistCandidates = async (surface, userId, candidates) => {
  const persisted = [];
  for (const candidate of candidates) {
    const entityRefType = candidate.entityRefType || candidate.entityType || surface;
    const entityRefId = candidate.entityRefId || candidate.entityId || null;
    const [record] = await Suggestion.findOrCreate({
      where: {
        user_id: userId,
        suggestion_for: surface,
        entity_ref_type: entityRefType,
        entity_ref_id: entityRefId,
      },
      defaults: {
        entity_id: candidate.entityId || null,
        entity_type: candidate.entityType || entityRefType,
        score: candidate.score ?? 0,
        reason: candidate.reason,
        metadata: candidate.metadata || null,
        search_terms: candidate.searchTerms,
        expires_at: candidate.expiresAt || null,
      },
    });

    const updatePayload = {};
    if (candidate.entityId && record.entity_id !== candidate.entityId) updatePayload.entity_id = candidate.entityId;
    if (candidate.entityType && record.entity_type !== candidate.entityType) updatePayload.entity_type = candidate.entityType;
    if (candidate.score !== undefined) updatePayload.score = candidate.score;
    if (candidate.reason && record.reason !== candidate.reason) updatePayload.reason = candidate.reason;
    if (candidate.metadata) updatePayload.metadata = candidate.metadata;
    if (candidate.searchTerms && record.search_terms !== candidate.searchTerms) {
      updatePayload.search_terms = candidate.searchTerms;
    }
    if (candidate.expiresAt && record.expires_at !== candidate.expiresAt) {
      updatePayload.expires_at = candidate.expiresAt;
    }
    if (Object.keys(updatePayload).length) {
      await record.update(updatePayload);
    }
    persisted.push(record);
  }
  return persisted;
};

const generateFeedCandidates = async ({ userId, limit, q }) => {
  const postTable = quoteTable(getTableName(Post));
  const reactionsTable = quoteTable(getTableName(Reaction));
  const commentsTable = quoteTable(getTableName(Comment));
  const postIdColumn = `${postTable}.${quoteIdentifier('id')}`;
  const reactionCountLiteral = literal(
    `(SELECT COUNT(*) FROM ${reactionsTable} AS reactions WHERE reactions.${quoteIdentifier('post_id')} = ${postIdColumn})`
  );
  const commentCountLiteral = literal(
    `(SELECT COUNT(*) FROM ${commentsTable} AS comments WHERE comments.${quoteIdentifier('post_id')} = ${postIdColumn})`
  );

  const where = { visibility: 'public' };
  if (userId) {
    where.user_id = { [Op.ne]: userId };
  }
  const posts = await Post.findAll({
    where,
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'email', 'role', 'is_verified', 'status'],
        include: [
          {
            model: Profile,
            as: 'profile',
            attributes: ['id', 'display_name', 'headline', 'avatar_url', 'location'],
          },
        ],
      },
    ],
    attributes: {
      include: [
        [reactionCountLiteral, 'reaction_count'],
        [commentCountLiteral, 'comment_count'],
      ],
    },
    order: [['created_at', 'DESC']],
    limit: limit * 6,
    subQuery: false,
  });

  const now = Date.now();
  const filtered = q
    ? posts.filter((post) => {
        const content = String(post.content || '').toLowerCase();
        const authorName = String(post.author?.profile?.display_name || '').toLowerCase();
        const headline = String(post.author?.profile?.headline || '').toLowerCase();
        const normalized = String(q).toLowerCase();
        return content.includes(normalized) || authorName.includes(normalized) || headline.includes(normalized);
      })
    : posts;

  return filtered.slice(0, limit * 3).map((post) => {
    const reactionCount = Number(post.get('reaction_count')) || 0;
    const commentCount = Number(post.get('comment_count')) || 0;
    const ageHours = (now - new Date(post.created_at).getTime()) / 3_600_000;
    const recencyBoost = Math.max(0, 48 - ageHours) / 48;
    const score = Number((reactionCount * 2 + commentCount + recencyBoost * 5).toFixed(4));

    const authorProfile = post.author?.profile;
    const title = `${authorProfile?.display_name || post.author?.email || 'Community'} posted`; // contextual headline
    const snippet = String(post.content || '').slice(0, 220);

    return {
      entityRefType: 'post',
      entityRefId: post.id,
      entityType: 'post',
      score,
      reason: 'Trending in your network',
      metadata: {
        post: {
          id: post.id,
          content: post.content,
          created_at: post.created_at,
          reaction_count: reactionCount,
          comment_count: commentCount,
        },
        author: post.author ? {
          id: post.author.id,
          display_name: authorProfile?.display_name,
          headline: authorProfile?.headline,
          avatar_url: authorProfile?.avatar_url,
          location: authorProfile?.location,
          role: post.author.role,
          is_verified: post.author.is_verified,
        } : null,
        preview: snippet,
        recency_hours: Number(ageHours.toFixed(2)),
      },
      searchTerms: normaliseSearchTerms(title, snippet, authorProfile?.display_name, authorProfile?.headline),
      expiresAt: dayjs(post.created_at).add(7, 'day').toDate(),
    };
  });
};

const generatePeopleCandidates = async ({ userId, limit, q }) => {
  if (!userId) return [];
  const followees = await UserFollow.findAll({
    where: { follower_id: userId },
    attributes: ['followee_id'],
  });
  const excludedUserIds = new Set([userId, ...followees.map((row) => row.followee_id)]);

  const profileTable = quoteTable(getTableName(Profile));
  const userFollowTable = quoteTable(getTableName(UserFollow));
  const reviewTable = quoteTable(getTableName(Review));
  const followerCountLiteral = literal(
    `(SELECT COUNT(*) FROM ${userFollowTable} AS uf WHERE uf.${quoteIdentifier('followee_id')} = ${profileTable}.${quoteIdentifier('user_id')})`
  );
  const reviewCountLiteral = literal(
    `(SELECT COUNT(*) FROM ${reviewTable} AS reviews WHERE reviews.${quoteIdentifier('profile_id')} = ${profileTable}.${quoteIdentifier('id')})`
  );

  const where = {
    user_id: { [Op.notIn]: Array.from(excludedUserIds) },
  };

  const include = [
    {
      model: User,
      as: 'user',
      attributes: ['id', 'role', 'is_verified', 'status'],
    },
    {
      model: Skill,
      as: 'skills',
      attributes: ['id', 'name'],
      through: { attributes: [] },
      required: false,
    },
  ];

  if (q) {
    const pattern = `%${String(q).toLowerCase()}%`;
    where[Op.and] = [
      {
        [Op.or]: [
          sequelize.where(fn('LOWER', col('Profile.display_name')), { [likeOperator()]: pattern }),
          sequelize.where(fn('LOWER', col('Profile.headline')), { [likeOperator()]: pattern }),
          sequelize.where(fn('LOWER', col('Profile.location')), { [likeOperator()]: pattern }),
          sequelize.where(fn('LOWER', col('skills.name')), { [likeOperator()]: pattern }),
        ],
      },
    ];
  }

  const profiles = await Profile.findAll({
    where,
    include,
    attributes: {
      include: [
        [followerCountLiteral, 'follower_count'],
        [reviewCountLiteral, 'review_count'],
      ],
    },
    order: [literal('follower_count DESC'), ['created_at', 'DESC']],
    limit: limit * 3,
    distinct: true,
    subQuery: false,
  });

  return profiles.map((profile) => {
    const followerCount = Number(profile.get('follower_count')) || 0;
    const reviewCount = Number(profile.get('review_count')) || 0;
    const verificationBoost = profile.user?.is_verified ? 5 : 0;
    const score = Number((followerCount * 1.5 + reviewCount + verificationBoost).toFixed(4));
    const skills = profile.skills?.map((skill) => ({ id: skill.id, name: skill.name })) || [];

    return {
      entityRefType: 'profile',
      entityRefId: profile.id,
      entityType: 'profile',
      score,
      reason: 'People you may want to connect with',
      metadata: {
        profile: {
          id: profile.id,
          user_id: profile.user_id,
          display_name: profile.display_name,
          headline: profile.headline,
          location: profile.location,
          avatar_url: profile.avatar_url,
          follower_count: followerCount,
          review_count: reviewCount,
          is_verified: profile.user?.is_verified,
          role: profile.user?.role,
        },
        skills,
      },
      searchTerms: normaliseSearchTerms(
        profile.display_name,
        profile.headline,
        profile.location,
        skills.map((skill) => skill.name)
      ),
      expiresAt: dayjs().add(14, 'day').toDate(),
    };
  });
};

const generateCatalogCandidates = async ({ surface, limit, q }) => {
  const now = new Date();
  const where = {
    type: surface,
    status: 'active',
    [Op.or]: [
      { starts_at: null },
      { starts_at: { [Op.lte]: now } },
    ],
    [Op.and]: [
      {
        [Op.or]: [
          { ends_at: null },
          { ends_at: { [Op.gte]: now } },
        ],
      },
    ],
  };

  if (q) {
    const pattern = `%${String(q).toLowerCase()}%`;
    where[Op.and].push(
      {
        [Op.or]: [
          sequelize.where(fn('LOWER', col('DiscoverEntity.title')), { [likeOperator()]: pattern }),
          sequelize.where(fn('LOWER', col('DiscoverEntity.subtitle')), { [likeOperator()]: pattern }),
          sequelize.where(fn('LOWER', col('DiscoverEntity.search_terms')), { [likeOperator()]: pattern }),
        ],
      }
    );
  }

  const entities = await DiscoverEntity.findAll({
    where,
    order: [['relevance_score', 'DESC'], ['created_at', 'DESC']],
    limit: limit * 2,
  });

  const label = SURFACE_LABELS[surface] || surface;

  return entities.map((entity) => ({
    entityId: entity.id,
    entityType: 'discover_entity',
    entityRefType: 'discover_entity',
    entityRefId: entity.id,
    score: Number(entity.relevance_score || 0),
    reason: `Recommended ${label}`,
    metadata: {
      title: entity.title,
      subtitle: entity.subtitle,
      description: entity.description,
      image_url: entity.image_url,
      tags: entity.tags,
      metrics: entity.metrics,
      link: entity.metadata?.link,
    },
    searchTerms: entity.search_terms,
    expiresAt: entity.ends_at || dayjs().add(30, 'day').toDate(),
  }));
};

const candidateFactories = {
  feed: ({ userId, limit, q }) => generateFeedCandidates({ userId, limit, q }),
  people: ({ userId, limit, q }) => generatePeopleCandidates({ userId, limit, q }),
  groups: ({ limit, q }) => generateCatalogCandidates({ surface: 'groups', limit, q }),
  companies: ({ limit, q }) => generateCatalogCandidates({ surface: 'companies', limit, q }),
  projects: ({ limit, q }) => generateCatalogCandidates({ surface: 'projects', limit, q }),
  gigs: ({ limit, q }) => generateCatalogCandidates({ surface: 'gigs', limit, q }),
  jobs: ({ limit, q }) => generateCatalogCandidates({ surface: 'jobs', limit, q }),
};

const ensureSuggestions = async ({ surface, userId, limit, q }) => {
  ensureSurface(surface);
  const now = new Date();
  const available = await Suggestion.count({
    where: {
      user_id: userId,
      suggestion_for: surface,
      [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: now } }],
    },
  });
  if (available >= limit) {
    return;
  }

  const factory = candidateFactories[surface];
  if (!factory) return;

  const candidates = await factory({ userId, limit, q });
  const needed = limit - available;
  if (!candidates.length) return;

  const trimmed = candidates.slice(0, Math.max(needed, limit));
  await persistCandidates(surface, userId, trimmed);
};

const resolveReferences = async (records, { includeDeleted = false } = {}) => {
  const map = {};
  const byType = records.reduce((acc, record) => {
    if (!record.entity_ref_type || !record.entity_ref_id) return acc;
    const type = record.entity_ref_type;
    if (!acc[type]) acc[type] = new Set();
    acc[type].add(record.entity_ref_id);
    return acc;
  }, {});

  if (byType.post) {
    const posts = await Post.findAll({
      where: { id: Array.from(byType.post) },
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'email', 'role', 'is_verified', 'status'],
          include: [
            { model: Profile, as: 'profile', attributes: ['display_name', 'headline', 'avatar_url'] },
          ],
        },
      ],
      paranoid: !includeDeleted,
    });
    map.post = posts.reduce((acc, post) => {
      acc[post.id] = post.get({ plain: true });
      return acc;
    }, {});
  }

  if (byType.profile) {
    const profiles = await Profile.findAll({
      where: { id: Array.from(byType.profile) },
      include: [
        { model: User, as: 'user', attributes: ['id', 'role', 'is_verified', 'status'] },
        { model: Skill, as: 'skills', attributes: ['id', 'name'], through: { attributes: [] } },
      ],
      paranoid: !includeDeleted,
    });
    map.profile = profiles.reduce((acc, profile) => {
      acc[profile.id] = profile.get({ plain: true });
      return acc;
    }, {});
  }

  return map;
};

const applyFieldFilter = (item, fields) => {
  if (!fields?.length) return item;
  const picked = {};
  fields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(item, field)) {
      picked[field] = item[field];
    }
  });
  if (!fields.includes('id') && item.id) {
    picked.id = item.id;
  }
  return picked;
};

const logImpressions = async (records, userId, surface, requestId) => {
  const now = new Date();
  const payload = records.map((record) => ({
    suggestion_id: record.id,
    user_id: userId,
    event_type: 'impression',
    occurred_at: now,
    context: { surface, request_id: requestId },
  }));
  if (payload.length) {
    await SuggestionEvent.bulkCreate(payload);
  }
};

const decorateSuggestions = async (records, { expand, fields, includeDeleted }) => {
  const resolved = expand.includes('reference') ? await resolveReferences(records, { includeDeleted }) : {};
  return records.map((record) => {
    const base = {
      id: record.id,
      surface: record.suggestion_for,
      score: Number(record.score || 0),
      reason: record.reason,
      metadata: record.metadata || null,
      delivered_at: record.delivered_at,
      expires_at: record.expires_at,
      pinned: record.pinned,
      entity_ref: {
        type: record.entity_ref_type,
        id: record.entity_ref_id,
      },
      entity_id: record.entity_id,
      entity_type: record.entity_type,
      created_at: record.created_at,
      updated_at: record.updated_at,
    };

    if (expand.includes('entity') && record.entity) {
      base.entity = record.entity;
    }

    if (expand.includes('reference') && record.entity_ref_type) {
      const resolvedEntity = resolved?.[record.entity_ref_type]?.[record.entity_ref_id];
      if (resolvedEntity) {
        base.reference = resolvedEntity;
      }
    }

    return applyFieldFilter(base, fields);
  });
};

const computeSearchTermsFromPayload = (payload, fallbackSurface) => {
  if (payload.search_terms) return payload.search_terms;
  const metadata = payload.metadata || {};
  const tags = metadata.tags;
  const tagList = Array.isArray(tags)
    ? tags
    : tags !== undefined && tags !== null
    ? [tags]
    : [];

  return normaliseSearchTerms(
    payload.reason,
    metadata.title,
    metadata.subtitle,
    metadata.description,
    tagList,
    fallbackSurface
  );
};

const isAdmin = (user) => user?.role === 'admin';

const ensureAuthenticated = (user) => {
  if (!user?.id) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }
};

const ensureReadAccess = (suggestion, currentUser) => {
  if (suggestion.user_id) {
    if (!currentUser?.id) {
      throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
    }
    if (suggestion.user_id !== currentUser.id && !isAdmin(currentUser)) {
      throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
    }
    return;
  }

  if (!isAdmin(currentUser)) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }
};

const ensureWriteAccess = (suggestion, currentUser) => {
  ensureAuthenticated(currentUser);
  if (isAdmin(currentUser)) {
    return;
  }
  if (!suggestion.user_id || suggestion.user_id !== currentUser.id) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }
};

const resolveIncludeDeleted = (include, currentUser) => include.includes('deleted') && isAdmin(currentUser);

const loadSuggestion = async (id, { includeDeleted = false, expand = [] } = {}) => {
  const include = [];
  if (expand.includes('entity')) {
    include.push({ model: DiscoverEntity, as: 'entity', paranoid: false });
  }

  const suggestion = await Suggestion.findByPk(id, {
    include,
    paranoid: !includeDeleted,
  });

  if (!suggestion) {
    throw new ApiError(404, 'Suggestion not found', 'SUGGESTION_NOT_FOUND');
  }

  return suggestion;
};

const decorateSingleSuggestion = async (suggestion, options) => {
  const plain = suggestion.get({ plain: true });
  const decorated = await decorateSuggestions([plain], options);
  return decorated[0];
};

const normaliseEventTypeFilter = (value) => {
  if (!value) return [];
  const values = normalizeArray(value);
  return values.filter((type) => EVENT_TYPES.includes(type));
};

const enrichEventContext = (context, suggestion, currentUser) => {
  const enriched = context ? { ...context } : {};
  if (!enriched.surface && suggestion?.suggestion_for) {
    enriched.surface = suggestion.suggestion_for;
  }
  if (!enriched.suggestion_id) {
    enriched.suggestion_id = suggestion?.id;
  }
  if (!enriched.user_id && currentUser?.id) {
    enriched.user_id = currentUser.id;
  }
  return enriched;
};

const baseEventCounts = () =>
  EVENT_TYPES.reduce((acc, type) => {
    acc[type] = 0;
    return acc;
  }, {});

const buildWhere = ({ surface, userId, includeDeleted, pagination, q }) => {
  const where = { suggestion_for: surface };
  if (userId) {
    where.user_id = userId;
  } else {
    where.user_id = { [Op.is]: null };
  }
  if (pagination.cursorValue !== undefined && pagination.cursorValue !== null) {
    where[pagination.sortField] = { [pagination.cursorOperator]: pagination.cursorValue };
  }
  if (q) {
    const pattern = `%${String(q).toLowerCase()}%`;
    where[Op.and] = [
      sequelize.where(fn('LOWER', col('Suggestion.search_terms')), { [likeOperator()]: pattern }),
    ];
  }
  return where;
};

const fetchSuggestions = async ({ surface, userId, limit, sort, cursor, q, includeDeleted, expand, fields }) => {
  ensureSurface(surface);
  const pagination = buildPagination(
    { limit, cursor, sort: sort || 'score:desc' },
    ['score', 'created_at', 'delivered_at']
  );

  await ensureSuggestions({ surface, userId, limit: pagination.limit, q });

  const include = [];
  if (expand.includes('entity')) {
    include.push({ model: DiscoverEntity, as: 'entity', paranoid: false });
  }

  const where = buildWhere({ surface, userId, includeDeleted, pagination, q });

  const suggestions = await Suggestion.findAll({
    where,
    include,
    order: [...pagination.order, ['created_at', 'DESC']],
    limit: pagination.limit,
    paranoid: !includeDeleted,
  });

  const plain = suggestions.map((item) => item.get({ plain: true }));
  const decorated = await decorateSuggestions(plain, { expand, fields, includeDeleted });
  const requestId = uuidv4();
  await logImpressions(plain, userId, surface, requestId);

  const idsNeedingDeliveryStamp = plain.filter((item) => !item.delivered_at).map((item) => item.id);
  if (idsNeedingDeliveryStamp.length) {
    await Suggestion.update(
      { delivered_at: new Date() },
      { where: { id: idsNeedingDeliveryStamp } }
    );
  }

  const nextCursor = plain.length ? encodeCursor(plain[plain.length - 1][pagination.sortField]) : null;

  return {
    data: decorated,
    meta: {
      next_cursor: nextCursor,
      request_id: requestId,
      sort: `${pagination.sortField}:${String(pagination.sortDirection).toLowerCase()}`,
    },
  };
};

const analyticsForSurface = async ({ surface, userId, includeDeleted }) => {
  const total = await Suggestion.count({
    where: { user_id: userId, suggestion_for: surface },
    paranoid: !includeDeleted,
  });
  const impressions = await SuggestionEvent.count({
    include: [
      {
        model: Suggestion,
        as: 'suggestion',
        attributes: [],
        where: { user_id: userId, suggestion_for: surface },
        required: true,
        paranoid: !includeDeleted,
      },
    ],
    where: { event_type: 'impression' },
  });
  const clicks = await SuggestionEvent.count({
    include: [
      {
        model: Suggestion,
        as: 'suggestion',
        attributes: [],
        where: { user_id: userId, suggestion_for: surface },
        required: true,
        paranoid: !includeDeleted,
      },
    ],
    where: { event_type: 'click' },
  });

  return { total, impressions, clicks };
};

const listSuggestions = async (query, currentUser) => {
  const expand = normalizeArray(query.expand);
  const fields = normalizeArray(query.fields);
  const include = normalizeArray(query.include);
  const analytics = query.analytics === true || query.analytics === 'true';

  const surface = query.for || 'feed';
  ensureSurface(surface);

  const userId = query.user_id ? query.user_id : currentUser?.id;
  if (!userId) {
    throw new ApiError(400, 'A user context is required for suggestions', 'USER_CONTEXT_REQUIRED');
  }

  if (query.user_id && query.user_id !== currentUser?.id && currentUser?.role !== 'admin') {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }

  const includeDeleted = include.includes('deleted') && currentUser?.role === 'admin';

  const result = await fetchSuggestions({
    surface,
    userId,
    limit: query.limit,
    sort: query.sort,
    cursor: query.cursor,
    q: query.q,
    includeDeleted,
    expand,
    fields,
  });

  if (analytics) {
    result.analytics = await analyticsForSurface({ surface, userId, includeDeleted });
  }

  return result;
};

const exploreSuggestions = async (query, currentUser) => {
  const expand = normalizeArray(query.expand);
  const fields = normalizeArray(query.fields);
  const include = normalizeArray(query.include);
  const analytics = query.analytics === true || query.analytics === 'true';
  const requested = normalizeArray(query.for);
  const surfaces = requested.length ? requested.filter((surface) => SURFACES.includes(surface)) : SURFACES;

  if (!currentUser?.id) {
    throw new ApiError(400, 'A user context is required for exploration', 'USER_CONTEXT_REQUIRED');
  }

  const includeDeleted = include.includes('deleted') && currentUser?.role === 'admin';

  const limit = Math.min(Number(query.limit) || 20, 100);
  const perSurface = Math.max(3, Math.ceil(limit / surfaces.length));
  await Promise.all(
    surfaces.map((surface) => ensureSuggestions({ surface, userId: currentUser.id, limit: perSurface, q: query.q }))
  );

  const pagination = buildPagination(
    { limit, cursor: query.cursor, sort: query.sort || 'score:desc' },
    ['score', 'created_at', 'delivered_at']
  );

  const includeDefs = [];
  if (expand.includes('entity')) {
    includeDefs.push({ model: DiscoverEntity, as: 'entity', paranoid: false });
  }

  const where = {
    suggestion_for: { [Op.in]: surfaces },
    user_id: currentUser.id,
  };
  if (pagination.cursorValue !== undefined && pagination.cursorValue !== null) {
    where[pagination.sortField] = { [pagination.cursorOperator]: pagination.cursorValue };
  }
  if (query.q) {
    const pattern = `%${String(query.q).toLowerCase()}%`;
    where[Op.and] = [
      sequelize.where(fn('LOWER', col('Suggestion.search_terms')), { [likeOperator()]: pattern }),
    ];
  }

  const suggestions = await Suggestion.findAll({
    where,
    include: includeDefs,
    order: [...pagination.order, ['score', 'DESC'], ['created_at', 'DESC']],
    limit: pagination.limit,
    paranoid: !includeDeleted,
  });

  const plain = suggestions.map((item) => item.get({ plain: true }));
  const decorated = await decorateSuggestions(plain, { expand, fields, includeDeleted });
  const requestId = uuidv4();
  await logImpressions(plain, currentUser.id, 'explore', requestId);

  const idsNeedingDeliveryStamp = plain.filter((item) => !item.delivered_at).map((item) => item.id);
  if (idsNeedingDeliveryStamp.length) {
    await Suggestion.update(
      { delivered_at: new Date() },
      { where: { id: idsNeedingDeliveryStamp } }
    );
  }

  const nextCursor = plain.length ? encodeCursor(plain[plain.length - 1][pagination.sortField]) : null;

  const response = {
    data: decorated,
    meta: {
      next_cursor: nextCursor,
      request_id: requestId,
      sort: `${pagination.sortField}:${String(pagination.sortDirection).toLowerCase()}`,
      surfaces,
    },
  };

  if (analytics) {
    const totals = await Suggestion.findAll({
      where: { user_id: currentUser.id, suggestion_for: { [Op.in]: surfaces } },
      attributes: ['suggestion_for', [fn('COUNT', col('id')), 'count']],
      group: ['suggestion_for'],
      paranoid: !includeDeleted,
    });
    const breakdown = totals.reduce((acc, row) => {
      acc[row.suggestion_for] = Number(row.get('count'));
      return acc;
    }, {});
    const eventCounts = await SuggestionEvent.findAll({
      include: [
        {
          model: Suggestion,
          as: 'suggestion',
          attributes: [],
          where: { user_id: currentUser.id, suggestion_for: { [Op.in]: surfaces } },
          required: true,
          paranoid: !includeDeleted,
        },
      ],
      attributes: ['event_type', [fn('COUNT', col('SuggestionEvent.id')), 'count']],
      group: ['event_type'],
    });
    const events = eventCounts.reduce((acc, row) => {
      acc[row.event_type] = Number(row.get('count'));
      return acc;
    }, {});
    response.analytics = { totals: breakdown, events };
  }

  return response;
};

const createSuggestion = async (payload, currentUser, { expand = [], fields = [] } = {}) => {
  ensureAuthenticated(currentUser);
  if (!payload.suggestion_for) {
    throw new ApiError(400, 'suggestion_for is required', 'VALIDATION_ERROR');
  }

  const surface = payload.suggestion_for;
  ensureSurface(surface);

  const targetUserId =
    payload.user_id === null
      ? null
      : payload.user_id !== undefined && payload.user_id !== null
      ? payload.user_id
      : currentUser.id;

  if (targetUserId === null && !isAdmin(currentUser)) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }
  if (targetUserId && targetUserId !== currentUser.id && !isAdmin(currentUser)) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }

  const entityRefType = payload.entity_ref_type || payload.entity_type || surface;
  const entityRefId = payload.entity_ref_id || payload.entity_id || null;

  const attributes = {
    user_id: targetUserId,
    suggestion_for: surface,
    entity_id: payload.entity_id || null,
    entity_type: payload.entity_type || null,
    entity_ref_id: entityRefId,
    entity_ref_type: entityRefType,
    score: payload.score ?? 0,
    reason: payload.reason || null,
    metadata: payload.metadata || null,
    search_terms: computeSearchTermsFromPayload(payload, surface),
    expires_at: payload.expires_at || null,
    delivered_at: payload.delivered_at || null,
    pinned: payload.pinned ?? false,
  };

  const [suggestion, created] = await Suggestion.findOrCreate({
    where: {
      user_id: targetUserId,
      suggestion_for: surface,
      entity_ref_type: entityRefType,
      entity_ref_id: entityRefId,
    },
    defaults: attributes,
    paranoid: false,
  });

  if (!created) {
    if (suggestion.get('deleted_at')) {
      await Suggestion.restore({ where: { id: suggestion.id } });
      await suggestion.reload({ paranoid: false });
    }
    await suggestion.update(attributes);
  }

  return decorateSingleSuggestion(suggestion, { expand, fields, includeDeleted: false });
};

const getSuggestion = async (id, query, currentUser) => {
  const expand = normalizeArray(query.expand);
  const fields = normalizeArray(query.fields);
  const include = normalizeArray(query.include);
  const includeDeleted = resolveIncludeDeleted(include, currentUser);

  const suggestion = await loadSuggestion(id, { includeDeleted, expand });
  ensureReadAccess(suggestion, currentUser);

  return decorateSingleSuggestion(suggestion, { expand, fields, includeDeleted });
};

const updateSuggestion = async (id, payload, currentUser, query = {}) => {
  const expand = normalizeArray(query.expand);
  const fields = normalizeArray(query.fields);
  const include = normalizeArray(query.include);
  const includeDeleted = resolveIncludeDeleted(include, currentUser);

  const suggestion = await loadSuggestion(id, { includeDeleted, expand });
  ensureWriteAccess(suggestion, currentUser);

  if (suggestion.get('deleted_at')) {
    throw new ApiError(409, 'Suggestion is deleted', 'SUGGESTION_DELETED');
  }

  const nextValues = {
    suggestion_for:
      payload.suggestion_for !== undefined ? payload.suggestion_for : suggestion.suggestion_for,
    entity_id: payload.entity_id !== undefined ? payload.entity_id : suggestion.entity_id,
    entity_type: payload.entity_type !== undefined ? payload.entity_type : suggestion.entity_type,
    entity_ref_id:
      payload.entity_ref_id !== undefined
        ? payload.entity_ref_id
        : payload.entity_id !== undefined
        ? payload.entity_id
        : suggestion.entity_ref_id,
    entity_ref_type:
      payload.entity_ref_type !== undefined
        ? payload.entity_ref_type
        : payload.entity_type !== undefined
        ? payload.entity_type
        : suggestion.entity_ref_type || suggestion.entity_type || suggestion.suggestion_for,
    score: payload.score !== undefined ? payload.score : suggestion.score,
    reason: payload.reason !== undefined ? payload.reason : suggestion.reason,
    metadata: payload.metadata !== undefined ? payload.metadata : suggestion.metadata,
    search_terms: payload.search_terms !== undefined ? payload.search_terms : suggestion.search_terms,
    expires_at: payload.expires_at !== undefined ? payload.expires_at : suggestion.expires_at,
    delivered_at: payload.delivered_at !== undefined ? payload.delivered_at : suggestion.delivered_at,
    pinned: payload.pinned !== undefined ? payload.pinned : suggestion.pinned,
  };

  const updates = {};

  if (payload.suggestion_for !== undefined) {
    ensureSurface(nextValues.suggestion_for);
    updates.suggestion_for = nextValues.suggestion_for;
  }
  if (payload.entity_id !== undefined) {
    updates.entity_id = nextValues.entity_id;
  }
  if (payload.entity_type !== undefined) {
    updates.entity_type = nextValues.entity_type;
  }
  if (payload.entity_ref_id !== undefined || payload.entity_id !== undefined) {
    updates.entity_ref_id = nextValues.entity_ref_id;
  }
  if (
    payload.entity_ref_type !== undefined ||
    payload.entity_type !== undefined ||
    payload.suggestion_for !== undefined
  ) {
    updates.entity_ref_type = nextValues.entity_ref_type;
  }
  if (payload.score !== undefined) {
    updates.score = nextValues.score;
  }
  if (payload.reason !== undefined) {
    updates.reason = nextValues.reason;
  }
  if (payload.metadata !== undefined) {
    updates.metadata = nextValues.metadata;
  }
  if (payload.expires_at !== undefined) {
    updates.expires_at = nextValues.expires_at;
  }
  if (payload.delivered_at !== undefined) {
    updates.delivered_at = nextValues.delivered_at;
  }
  if (payload.pinned !== undefined) {
    updates.pinned = nextValues.pinned;
  }
  if (payload.search_terms !== undefined) {
    updates.search_terms = nextValues.search_terms;
  } else if (
    payload.reason !== undefined ||
    payload.metadata !== undefined ||
    payload.suggestion_for !== undefined
  ) {
    updates.search_terms = computeSearchTermsFromPayload(
      { reason: nextValues.reason, metadata: nextValues.metadata },
      nextValues.suggestion_for
    );
  }

  if (!Object.keys(updates).length) {
    return decorateSingleSuggestion(suggestion, { expand, fields, includeDeleted });
  }

  await suggestion.update(updates);
  const refreshed = await loadSuggestion(id, { includeDeleted, expand });
  return decorateSingleSuggestion(refreshed, { expand, fields, includeDeleted });
};

const deleteSuggestion = async (id, currentUser) => {
  const suggestion = await loadSuggestion(id, { includeDeleted: true });
  ensureWriteAccess(suggestion, currentUser);

  if (suggestion.get('deleted_at')) {
    return false;
  }

  await Suggestion.destroy({ where: { id } });
  return true;
};

const restoreSuggestion = async (id, currentUser, { expand = [], fields = [] } = {}) => {
  const suggestion = await loadSuggestion(id, { includeDeleted: true, expand });
  ensureWriteAccess(suggestion, currentUser);

  if (!suggestion.get('deleted_at')) {
    return decorateSingleSuggestion(suggestion, { expand, fields, includeDeleted: false });
  }

  await Suggestion.restore({ where: { id } });
  const restored = await loadSuggestion(id, { includeDeleted: false, expand });
  return decorateSingleSuggestion(restored, { expand, fields, includeDeleted: false });
};

const recordEvent = async (id, payload, currentUser) => {
  ensureAuthenticated(currentUser);
  if (!EVENT_TYPES.includes(payload.event_type)) {
    throw new ApiError(400, 'Unsupported suggestion event', 'UNSUPPORTED_EVENT');
  }

  const suggestion = await loadSuggestion(id, { includeDeleted: false });
  ensureReadAccess(suggestion, currentUser);

  const event = await SuggestionEvent.create({
    suggestion_id: suggestion.id,
    user_id: currentUser.id,
    event_type: payload.event_type,
    occurred_at: payload.occurred_at || new Date(),
    context: enrichEventContext(payload.context, suggestion.get({ plain: true }), currentUser),
  });

  return event.get({ plain: true });
};

const listSuggestionEvents = async (id, query, currentUser) => {
  const include = normalizeArray(query.include);
  const includeDeleted = resolveIncludeDeleted(include, currentUser);

  const suggestion = await loadSuggestion(id, { includeDeleted, expand: [] });
  ensureReadAccess(suggestion, currentUser);

  const pagination = buildPagination(
    { limit: query.limit, cursor: query.cursor, sort: query.sort || 'occurred_at:desc' },
    ['occurred_at', 'created_at']
  );

  const where = { suggestion_id: suggestion.id };
  const eventTypes = normaliseEventTypeFilter(query.event_type);
  if (eventTypes.length) {
    where.event_type = { [Op.in]: eventTypes };
  }
  if (pagination.cursorValue !== undefined && pagination.cursorValue !== null) {
    where[pagination.sortField] = { [pagination.cursorOperator]: pagination.cursorValue };
  }

  const events = await SuggestionEvent.findAll({
    where,
    order: [...pagination.order, ['created_at', 'DESC']],
    limit: pagination.limit,
  });

  const plain = events.map((event) => event.get({ plain: true }));
  const nextCursor = plain.length ? encodeCursor(plain[plain.length - 1][pagination.sortField]) : null;

  const response = {
    data: plain,
    meta: {
      next_cursor: nextCursor,
      sort: `${pagination.sortField}:${String(pagination.sortDirection).toLowerCase()}`,
      suggestion_id: suggestion.id,
    },
  };

  const analytics = query.analytics === true || query.analytics === 'true';
  if (analytics) {
    const totals = await SuggestionEvent.findAll({
      where: { suggestion_id: suggestion.id },
      attributes: ['event_type', [fn('COUNT', col('SuggestionEvent.id')), 'count']],
      group: ['event_type'],
    });
    response.analytics = totals.reduce((acc, row) => {
      acc[row.event_type] = Number(row.get('count'));
      return acc;
    }, baseEventCounts());
  }

  return response;
};

const suggestionAnalytics = async (id, query, currentUser) => {
  const expand = normalizeArray(query.expand);
  const fields = normalizeArray(query.fields);
  const include = normalizeArray(query.include);
  const includeDeleted = resolveIncludeDeleted(include, currentUser);

  const suggestion = await loadSuggestion(id, { includeDeleted, expand });
  ensureReadAccess(suggestion, currentUser);

  const from = query.from ? dayjs(query.from).toDate() : undefined;
  const to = query.to ? dayjs(query.to).toDate() : undefined;
  const allowedGranularities = ['hour', 'day', 'month'];
  const granularity = allowedGranularities.includes(query.granularity)
    ? query.granularity
    : 'day';

  const where = { suggestion_id: suggestion.id };
  if (from || to) {
    where.occurred_at = {};
    if (from) {
      where.occurred_at[Op.gte] = from;
    }
    if (to) {
      where.occurred_at[Op.lte] = to;
    }
  }

  const events = await SuggestionEvent.findAll({
    where,
    order: [['occurred_at', 'ASC']],
    attributes: ['event_type', 'occurred_at'],
    raw: true,
  });

  const totals = baseEventCounts();
  const timelineMap = new Map();

  events.forEach((event) => {
    totals[event.event_type] = (totals[event.event_type] || 0) + 1;

    const bucketStart = dayjs(event.occurred_at).startOf(granularity);
    const bucketKey = bucketStart.valueOf();
    if (!timelineMap.has(bucketKey)) {
      timelineMap.set(bucketKey, {
        start: bucketStart.toISOString(),
        end: bucketStart.add(1, granularity).toISOString(),
        counts: baseEventCounts(),
      });
    }
    const bucket = timelineMap.get(bucketKey);
    bucket.counts[event.event_type] = (bucket.counts[event.event_type] || 0) + 1;
  });

  const timeline = Array.from(timelineMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, bucket]) => bucket);

  const impressions = totals.impression || 0;
  const clicks = totals.click || 0;
  const conversionRate = impressions ? Number((clicks / impressions).toFixed(4)) : 0;

  const decorated = await decorateSingleSuggestion(suggestion, { expand, fields, includeDeleted });

  return {
    data: {
      suggestion: decorated,
      totals,
      conversion_rate: conversionRate,
      events: events.length,
      timeline,
    },
    meta: {
      suggestion_id: suggestion.id,
      from: from ? from.toISOString() : null,
      to: to ? to.toISOString() : null,
      granularity,
    },
  };
};

module.exports = {
  listSuggestions,
  exploreSuggestions,
  createSuggestion,
  getSuggestion,
  updateSuggestion,
  deleteSuggestion,
  restoreSuggestion,
  recordEvent,
  listSuggestionEvents,
  suggestionAnalytics,
};
