const { Op } = require('sequelize');
const {
  Profile,
  ProfileExperience,
  ProfileEducation,
  ProfileSkill,
  ProfileTag,
  Skill,
  Tag,
  PortfolioItem,
  Review,
  FreelancerProfile,
  AgencyProfile,
  CompanyProfile,
  ProfileView,
  UserFollow,
  Connection,
  Notification,
  sequelize,
} = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { aggregateByPeriod } = require('../utils/analytics');
const { buildPagination, encodeCursor } = require('../utils/pagination');

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const buildRangeFilter = (from, to) => {
  const range = {};
  const fromDate = parseDate(from);
  const toDate = parseDate(to);

  if (fromDate) {
    range[Op.gte] = fromDate;
  }

  if (toDate) {
    range[Op.lte] = toDate;
  }

  return range;
};

const applyRangeFilter = (where, field, from, to) => {
  const range = buildRangeFilter(from, to);
  if (Object.keys(range).length) {
    where[field] = range;
  }
};

const getCursorValue = (row, field) => {
  if (!row) return undefined;
  if (typeof row.get === 'function') {
    const value = row.get(field);
    if (value !== undefined) return value;
  }
  return row[field];
};

const ensureProfileByUser = async (userId, { includeDeleted = false, transaction } = {}) => {
  const profile = await Profile.findOne({
    where: { user_id: userId },
    paranoid: !includeDeleted,
    transaction,
  });
  if (!profile) {
    throw new ApiError(404, 'Profile not found', 'PROFILE_NOT_FOUND');
  }
  return profile;
};

const resolveProfile = async (identifier, { includeDeleted = false } = {}) => {
  const profile =
    (await Profile.findByPk(identifier, { paranoid: !includeDeleted })) ||
    (await Profile.findOne({ where: { user_id: identifier }, paranoid: !includeDeleted }));
  if (!profile) {
    throw new ApiError(404, 'Profile not found', 'PROFILE_NOT_FOUND');
  }
  return profile;
};

const paginateRecords = async (
  model,
  {
    where,
    pagination,
    includeDeleted = false,
    analytics = false,
    include = [],
    orderFallback = [['created_at', 'DESC']],
  }
) => {
  const limit = pagination.limit;
  const baseWhere = where ? { ...where } : {};
  if (pagination.cursorValue !== undefined && pagination.cursorValue !== null) {
    const existingConstraint = baseWhere[pagination.sortField];
    if (existingConstraint && typeof existingConstraint === 'object' && !Array.isArray(existingConstraint)) {
      baseWhere[pagination.sortField] = {
        ...existingConstraint,
        [pagination.cursorOperator]: pagination.cursorValue,
      };
    } else if (existingConstraint !== undefined) {
      baseWhere[pagination.sortField] = {
        [Op.eq]: existingConstraint,
        [pagination.cursorOperator]: pagination.cursorValue,
      };
    } else {
      baseWhere[pagination.sortField] = { [pagination.cursorOperator]: pagination.cursorValue };
    }
  }

  const queryOptions = {
    where: baseWhere,
    order: pagination.order.length ? pagination.order : orderFallback,
    limit: limit + 1,
    paranoid: !includeDeleted,
    include,
  };

  const rows = await model.findAll(queryOptions);
  const hasNext = rows.length > limit;
  const data = hasNext ? rows.slice(0, limit) : rows;
  const last = data[data.length - 1];
  const nextCursor = hasNext ? encodeCursor(getCursorValue(last, pagination.sortField)) : null;

  const response = { data, next_cursor: nextCursor };

  if (analytics) {
    const total = await model.count({ where, paranoid: !includeDeleted, include });
    response.analytics = { total };
  }

  return response;
};

const normalizeSkillInput = (entries = []) =>
  entries
    .map((entry) =>
      typeof entry === 'string'
        ? { name: entry.trim(), proficiency: null }
        : { name: entry.name?.trim(), proficiency: entry.proficiency ?? null }
    )
    .filter((entry) => entry.name);

const normalizeTagInput = (entries = []) =>
  entries
    .map((entry) => (typeof entry === 'string' ? entry.trim() : entry.name?.trim()))
    .filter(Boolean);

const getProfile = async (userId, { includeDeleted = false, expand = [] } = {}) => {
  const expansions = new Set(expand);
  if (expansions.size === 0) {
    ['experiences', 'education', 'portfolio', 'reviews', 'skills', 'tags', 'freelancer_overlay'].forEach((key) =>
      expansions.add(key)
    );
  }

  const include = [];
  if (expansions.has('experiences')) {
    include.push({ model: ProfileExperience, as: 'experiences', paranoid: !includeDeleted });
  }
  if (expansions.has('education')) {
    include.push({ model: ProfileEducation, as: 'education', paranoid: !includeDeleted });
  }
  if (expansions.has('portfolio')) {
    include.push({ model: PortfolioItem, as: 'portfolio', paranoid: !includeDeleted });
  }
  if (expansions.has('reviews')) {
    include.push({ model: Review, as: 'reviews', paranoid: !includeDeleted });
  }
  if (expansions.has('skills')) {
    include.push({ model: Skill, as: 'skills' });
  }
  if (expansions.has('tags')) {
    include.push({ model: Tag, as: 'tags' });
  }
  if (expansions.has('freelancer_overlay')) {
    include.push({ model: FreelancerProfile, as: 'freelancer_overlay', paranoid: !includeDeleted });
  }

  const profile = await Profile.findOne({
    where: { user_id: userId },
    include,
    paranoid: !includeDeleted,
  });
  if (!profile) {
    throw new ApiError(404, 'Profile not found', 'PROFILE_NOT_FOUND');
  }
  return profile;
};

const updateProfile = async (userId, data) => {
  const profile = await ensureProfileByUser(userId);
  await profile.update(data);
  return getProfile(userId);
};

const listExperiences = async (userId, { limit, cursor, sort, analytics = false, includeDeleted = false } = {}) => {
  const profile = await ensureProfileByUser(userId, { includeDeleted });
  const pagination = buildPagination({ limit, cursor, sort }, ['start_date', 'created_at']);
  return paginateRecords(ProfileExperience, {
    where: { profile_id: profile.id },
    pagination,
    includeDeleted,
    analytics,
    orderFallback: [['start_date', 'DESC']],
  });
};

const getExperience = async (userId, expId, { includeDeleted = false } = {}) => {
  const profile = await ensureProfileByUser(userId, { includeDeleted });
  const experience = await ProfileExperience.findOne({
    where: { id: expId, profile_id: profile.id },
    paranoid: !includeDeleted,
  });
  if (!experience) {
    throw new ApiError(404, 'Experience not found', 'EXPERIENCE_NOT_FOUND');
  }
  return experience;
};

const createExperience = async (userId, payload) => {
  const profile = await ensureProfileByUser(userId);
  return ProfileExperience.create({ ...payload, profile_id: profile.id });
};

const updateExperience = async (userId, expId, payload) => {
  const experience = await getExperience(userId, expId);
  await experience.update(payload);
  return experience;
};

const deleteExperience = async (userId, expId) => {
  const experience = await getExperience(userId, expId);
  await experience.destroy();
  return { success: true };
};

const listEducation = async (userId, { limit, cursor, sort, analytics = false, includeDeleted = false } = {}) => {
  const profile = await ensureProfileByUser(userId, { includeDeleted });
  const pagination = buildPagination({ limit, cursor, sort }, ['start_date', 'created_at']);
  return paginateRecords(ProfileEducation, {
    where: { profile_id: profile.id },
    pagination,
    includeDeleted,
    analytics,
    orderFallback: [['start_date', 'DESC']],
  });
};

const getEducation = async (userId, eduId, { includeDeleted = false } = {}) => {
  const profile = await ensureProfileByUser(userId, { includeDeleted });
  const education = await ProfileEducation.findOne({
    where: { id: eduId, profile_id: profile.id },
    paranoid: !includeDeleted,
  });
  if (!education) {
    throw new ApiError(404, 'Education not found', 'EDUCATION_NOT_FOUND');
  }
  return education;
};

const createEducation = async (userId, payload) => {
  const profile = await ensureProfileByUser(userId);
  return ProfileEducation.create({ ...payload, profile_id: profile.id });
};

const updateEducation = async (userId, eduId, payload) => {
  const education = await getEducation(userId, eduId);
  await education.update(payload);
  return education;
};

const deleteEducation = async (userId, eduId) => {
  const education = await getEducation(userId, eduId);
  await education.destroy();
  return { success: true };
};

const listSkills = async (userId, { analytics = false } = {}) => {
  const profile = await ensureProfileByUser(userId);
  const skills = await profile.getSkills({
    joinTableAttributes: ['proficiency', 'created_at', 'updated_at'],
    order: [['name', 'ASC']],
  });
  const response = { data: skills };
  if (analytics) {
    const total = await ProfileSkill.count({ where: { profile_id: profile.id } });
    response.analytics = { total };
  }
  return response;
};

const upsertSkills = async (userId, skillEntries) => {
  const normalized = normalizeSkillInput(skillEntries);
  if (!normalized.length) {
    return { data: [] };
  }

  return sequelize.transaction(async (transaction) => {
    const profile = await ensureProfileByUser(userId, { transaction });
    const skillIds = [];
    for (const entry of normalized) {
      const [skill] = await Skill.findOrCreate({
        where: { name: entry.name },
        defaults: { description: null },
        transaction,
      });
      skillIds.push(skill.id);
      const [pivot] = await ProfileSkill.findOrCreate({
        where: { profile_id: profile.id, skill_id: skill.id },
        defaults: { proficiency: entry.proficiency },
        transaction,
      });
      if (entry.proficiency !== null && entry.proficiency !== undefined) {
        await pivot.update({ proficiency: entry.proficiency }, { transaction });
      }
    }

    await ProfileSkill.destroy({
      where: { profile_id: profile.id, skill_id: { [Op.notIn]: skillIds } },
      transaction,
    });

    const skills = await profile.getSkills({
      joinTableAttributes: ['proficiency', 'created_at', 'updated_at'],
      order: [['name', 'ASC']],
      transaction,
    });
    return { data: skills };
  });
};

const deleteSkills = async (userId, identifiers = []) => {
  const profile = await ensureProfileByUser(userId);
  if (!identifiers.length) {
    await ProfileSkill.destroy({ where: { profile_id: profile.id } });
    return { success: true };
  }

  const uuids = identifiers.filter((value) => /^[0-9a-fA-F-]{36}$/.test(value));
  const names = identifiers.filter((value) => !/^[0-9a-fA-F-]{36}$/.test(value));

  let skillIds = [...uuids];
  if (names.length) {
    const matched = await Skill.findAll({ where: { name: { [Op.in]: names } } });
    skillIds = skillIds.concat(matched.map((skill) => skill.id));
  }

  if (!skillIds.length) {
    return { success: true };
  }

  await ProfileSkill.destroy({ where: { profile_id: profile.id, skill_id: { [Op.in]: skillIds } } });
  return { success: true };
};

const listTags = async (userId, { analytics = false } = {}) => {
  const profile = await ensureProfileByUser(userId);
  const tags = await profile.getTags({ order: [['name', 'ASC']] });
  const response = { data: tags };
  if (analytics) {
    const total = await ProfileTag.count({ where: { profile_id: profile.id } });
    response.analytics = { total };
  }
  return response;
};

const upsertTags = async (userId, tagEntries) => {
  const normalized = normalizeTagInput(tagEntries);
  if (!normalized.length) {
    return { data: [] };
  }

  return sequelize.transaction(async (transaction) => {
    const profile = await ensureProfileByUser(userId, { transaction });
    const tagIds = [];
    for (const name of normalized) {
      const [tag] = await Tag.findOrCreate({ where: { name }, defaults: { description: null }, transaction });
      tagIds.push(tag.id);
      await ProfileTag.findOrCreate({
        where: { profile_id: profile.id, tag_id: tag.id },
        transaction,
      });
    }

    await ProfileTag.destroy({ where: { profile_id: profile.id, tag_id: { [Op.notIn]: tagIds } }, transaction });
    const tags = await profile.getTags({ order: [['name', 'ASC']], transaction });
    return { data: tags };
  });
};

const deleteTags = async (userId, identifiers = []) => {
  const profile = await ensureProfileByUser(userId);
  if (!identifiers.length) {
    await ProfileTag.destroy({ where: { profile_id: profile.id } });
    return { success: true };
  }

  const uuids = identifiers.filter((value) => /^[0-9a-fA-F-]{36}$/.test(value));
  const names = identifiers.filter((value) => !/^[0-9a-fA-F-]{36}$/.test(value));

  let tagIds = [...uuids];
  if (names.length) {
    const matched = await Tag.findAll({ where: { name: { [Op.in]: names } } });
    tagIds = tagIds.concat(matched.map((tag) => tag.id));
  }

  if (!tagIds.length) {
    return { success: true };
  }

  await ProfileTag.destroy({ where: { profile_id: profile.id, tag_id: { [Op.in]: tagIds } } });
  return { success: true };
};

const listPortfolio = async (userId, { limit, cursor, sort, analytics = false, includeDeleted = false } = {}) => {
  const profile = await ensureProfileByUser(userId, { includeDeleted });
  const pagination = buildPagination({ limit, cursor, sort }, ['created_at']);
  return paginateRecords(PortfolioItem, {
    where: { profile_id: profile.id },
    pagination,
    includeDeleted,
    analytics,
    orderFallback: [['created_at', 'DESC']],
  });
};

const getPortfolioItem = async (userId, itemId, { includeDeleted = false } = {}) => {
  const profile = await ensureProfileByUser(userId, { includeDeleted });
  const item = await PortfolioItem.findOne({
    where: { id: itemId, profile_id: profile.id },
    paranoid: !includeDeleted,
  });
  if (!item) {
    throw new ApiError(404, 'Portfolio item not found', 'PORTFOLIO_NOT_FOUND');
  }
  return item;
};

const addPortfolioItem = async (userId, payload) => {
  const profile = await ensureProfileByUser(userId);
  return PortfolioItem.create({ ...payload, profile_id: profile.id });
};

const updatePortfolioItem = async (userId, itemId, payload) => {
  const item = await getPortfolioItem(userId, itemId);
  await item.update(payload);
  return item;
};

const deletePortfolioItem = async (userId, itemId) => {
  const item = await getPortfolioItem(userId, itemId);
  await item.destroy();
  return { success: true };
};

const listReviews = async (userId, { limit, cursor, sort, analytics = false, includeDeleted = false } = {}) => {
  const profile = await ensureProfileByUser(userId, { includeDeleted });
  const pagination = buildPagination({ limit, cursor, sort }, ['created_at', 'rating']);
  return paginateRecords(Review, {
    where: { profile_id: profile.id },
    pagination,
    includeDeleted,
    analytics,
    include: [{ association: 'reviewer', attributes: ['id', 'email'], required: false }],
    orderFallback: [['created_at', 'DESC']],
  });
};

const addReview = async (userId, payload, { actor } = {}) => {
  const profile = await ensureProfileByUser(userId);

  if (actor?.role !== 'admin' && actor?.id !== payload.reviewer_id) {
    throw new ApiError(403, 'You may only review as yourself', 'FORBIDDEN');
  }

  if (actor?.role !== 'admin') {
    const hasEngagement = await Connection.findOne({
      where: {
        status: 'accepted',
        [Op.or]: [
          { requester_id: payload.reviewer_id, addressee_id: profile.user_id },
          { requester_id: profile.user_id, addressee_id: payload.reviewer_id },
        ],
      },
    });

    if (!hasEngagement) {
      throw new ApiError(422, 'Review not allowed without an accepted engagement', 'REVIEW_NOT_ALLOWED');
    }
  }

  return Review.create({ ...payload, profile_id: profile.id });
};

const recordProfileView = async ({ profileId, viewerId, source }) => {
  const profile = await resolveProfile(profileId);
  return ProfileView.create({
    profile_id: profile.id,
    viewer_id: viewerId,
    source: source || 'direct',
    viewed_at: new Date(),
  });
};

const trafficAnalytics = async ({ id, from, to, by = 'day' }) => {
  const profile = await resolveProfile(id);
  const queryGenerator = ProfileView.sequelize.getQueryInterface().queryGenerator;
  const tableSql = queryGenerator.quoteTable(ProfileView.getTableName());
  const columnSql = `${tableSql}.${queryGenerator.quoteIdentifier('profile_id')}`;
  const buckets = await aggregateByPeriod(ProfileView, 'viewed_at', {
    granularity: ['day', 'week', 'month'].includes(by) ? by : 'day',
    from,
    to,
    includeDeleted: false,
    extraWhere: [`${columnSql} = :profileId`],
    replacements: { profileId: profile.id },
  });

  return buckets.map((bucket) => ({ bucket: bucket.bucket, visits: bucket.count }));
};

const engagementAnalytics = async ({ id, from, to }) => {
  const profile = await resolveProfile(id);

  const viewWhere = { profile_id: profile.id };
  applyRangeFilter(viewWhere, 'viewed_at', from, to);

  const followWhere = { followee_id: profile.user_id };
  applyRangeFilter(followWhere, 'created_at', from, to);

  const messageWhere = {
    user_id: profile.user_id,
    [Op.or]: [{ channel: 'message' }, { type: { [Op.like]: 'message%' } }],
  };
  applyRangeFilter(messageWhere, 'created_at', from, to);

  const [views, follows, messages] = await Promise.all([
    ProfileView.count({ where: viewWhere }),
    UserFollow.count({ where: followWhere }),
    Notification.count({ where: messageWhere }),
  ]);

  return { views, follows, messages };
};

const topProfiles = async ({ metric = 'views', from, to, limit = 10 } = {}) => {
  const safeLimit = Math.min(Number(limit) || 10, 50);
  const replacements = { limit: safeLimit };
  const filters = ['p.deleted_at IS NULL'];

  const fromDate = parseDate(from);
  const toDate = parseDate(to);

  if (metric === 'follows') {
    if (fromDate) {
      filters.push('uf.created_at >= :from');
      replacements.from = fromDate;
    }
    if (toDate) {
      filters.push('uf.created_at <= :to');
      replacements.to = toDate;
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const query = `
      SELECT p.id, p.display_name, p.user_id, COUNT(uf.followee_id) AS score
      FROM profiles p
      JOIN user_follows uf ON uf.followee_id = p.user_id
      ${whereClause}
      GROUP BY p.id, p.display_name, p.user_id
      ORDER BY score DESC, p.display_name ASC
      LIMIT :limit
    `;

    const [rows] = await sequelize.query(query, {
      replacements,
      type: sequelize.QueryTypes.SELECT,
    });

    return rows.map((row) => ({ ...row, metric, score: Number(row.score) }));
  }

  if (fromDate) {
    filters.push('pv.viewed_at >= :from');
    replacements.from = fromDate;
  }
  if (toDate) {
    filters.push('pv.viewed_at <= :to');
    replacements.to = toDate;
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const query = `
    SELECT p.id, p.display_name, p.user_id, COUNT(pv.id) AS score
    FROM profiles p
    JOIN profile_views pv ON pv.profile_id = p.id
    ${whereClause}
    GROUP BY p.id, p.display_name, p.user_id
    ORDER BY score DESC, p.display_name ASC
    LIMIT :limit
  `;

  const [rows] = await sequelize.query(query, {
    replacements,
    type: sequelize.QueryTypes.SELECT,
  });

  return rows.map((row) => ({ ...row, metric, score: Number(row.score) }));
};

const getFreelancerOverlay = async (userId, { includeDeleted = false } = {}) => {
  const profile = await ensureProfileByUser(userId, { includeDeleted });
  const overlay = await FreelancerProfile.findOne({
    where: { profile_id: profile.id },
    paranoid: !includeDeleted,
  });
  if (!overlay) {
    throw new ApiError(404, 'Freelancer overlay not found', 'FREELANCER_OVERLAY_NOT_FOUND');
  }
  return overlay;
};

const updateFreelancerOverlay = async (userId, payload) => {
  const profile = await ensureProfileByUser(userId);
  const [overlay] = await FreelancerProfile.findOrCreate({
    where: { profile_id: profile.id },
    defaults: { ...payload, profile_id: profile.id },
  });
  await overlay.update(payload);
  return overlay;
};

const getAgencyOverlay = async (orgId, { includeDeleted = false } = {}) => {
  const overlay = await AgencyProfile.findOne({ where: { org_id: orgId }, paranoid: !includeDeleted });
  if (!overlay) {
    throw new ApiError(404, 'Agency profile not found', 'AGENCY_PROFILE_NOT_FOUND');
  }
  return overlay;
};

const updateAgencyOverlay = async (orgId, payload) => {
  const [overlay] = await AgencyProfile.findOrCreate({
    where: { org_id: orgId },
    defaults: { ...payload, org_id: orgId },
  });
  await overlay.update(payload);
  return overlay;
};

const getCompanyOverlay = async (orgId, { includeDeleted = false } = {}) => {
  const overlay = await CompanyProfile.findOne({ where: { org_id: orgId }, paranoid: !includeDeleted });
  if (!overlay) {
    throw new ApiError(404, 'Company profile not found', 'COMPANY_PROFILE_NOT_FOUND');
  }
  return overlay;
};

const updateCompanyOverlay = async (orgId, payload) => {
  const [overlay] = await CompanyProfile.findOrCreate({
    where: { org_id: orgId },
    defaults: { ...payload, org_id: orgId },
  });
  await overlay.update(payload);
  return overlay;
};

module.exports = {
  getProfile,
  updateProfile,
  listExperiences,
  getExperience,
  createExperience,
  updateExperience,
  deleteExperience,
  listEducation,
  getEducation,
  createEducation,
  updateEducation,
  deleteEducation,
  listSkills,
  upsertSkills,
  deleteSkills,
  listTags,
  upsertTags,
  deleteTags,
  listPortfolio,
  getPortfolioItem,
  addPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  listReviews,
  addReview,
  recordProfileView,
  trafficAnalytics,
  engagementAnalytics,
  topProfiles,
  getFreelancerOverlay,
  updateFreelancerOverlay,
  getAgencyOverlay,
  updateAgencyOverlay,
  getCompanyOverlay,
  updateCompanyOverlay,
};
