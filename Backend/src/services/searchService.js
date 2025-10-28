const { Op, fn, col, cast } = require('sequelize');
const { ApiError } = require('../middleware/errorHandler');
const { buildPagination, encodeCursor } = require('../utils/pagination');
const {
  Profile,
  User,
  Skill,
  Tag,
  FreelancerProfile,
  Agency,
  Company,
  DiscoverEntity,
  Job,
  JobTag,
  Group,
  SearchQuery,
  sequelize,
} = require('../models');

const SEARCH_TYPES = SearchQuery.TYPES;
const HISTORY_SORT_FIELDS = ['executed_at', 'created_at'];

const likeOperator = () => (sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like);

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean);
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const lowerColumn = (column, { json = false } = {}) => {
  const dialect = sequelize.getDialect();
  if (json) {
    const target = dialect === 'mysql' || dialect === 'mariadb' ? 'CHAR' : 'TEXT';
    return fn('LOWER', cast(col(column), target));
  }
  return fn('LOWER', col(column));
};

const buildPaginationEnvelope = (rows, pagination, count, transform = (item) => item) => {
  const hasMore = rows.length > pagination.limit;
  const limitedRows = hasMore ? rows.slice(0, pagination.limit) : rows;
  const lastRow = limitedRows[limitedRows.length - 1];
  const nextCursorValue = hasMore ? (lastRow?.get ? lastRow.get(pagination.sortField) : lastRow?.[pagination.sortField]) : undefined;
  const data = limitedRows.map((row) => transform(row.toJSON ? row.toJSON() : row));
  const total = typeof count === 'number' ? count : Array.isArray(count) ? count.length : 0;
  return {
    data,
    total,
    page: {
      next_cursor: hasMore ? encodeCursor(nextCursorValue) : null,
      limit: pagination.limit,
    },
  };
};

const incrementCount = (container, raw) => {
  if (raw === undefined || raw === null) return;
  const label = String(raw).trim();
  if (!label) return;
  const key = label.toLowerCase();
  const current = container.get(key) || { value: label, count: 0 };
  current.count += 1;
  container.set(key, current);
};

const summariseMap = (map, limit = 5) =>
  Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

const safeFilters = (filters) => {
  const copy = {};
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value) && value.length === 0) return;
    if (Array.isArray(value)) {
      copy[key] = value;
      return;
    }
    const trimmed = typeof value === 'string' ? value.trim() : value;
    if (trimmed === '') return;
    copy[key] = trimmed;
  });
  return Object.keys(copy).length ? copy : null;
};

const logSearchQuery = async ({
  query,
  searchType,
  filters,
  resultsCount,
  analyticsSnapshot,
  duration,
  user,
  requestMeta,
}) => {
  try {
    await SearchQuery.create({
      user_id: user?.id ?? null,
      search_type: searchType,
      query: query ?? null,
      filters: safeFilters(filters),
      results_count: resultsCount ?? 0,
      analytics_snapshot: analyticsSnapshot || null,
      executed_at: new Date(),
      duration_ms: duration ?? null,
      request_ip: requestMeta?.ip || null,
      user_agent: requestMeta?.userAgent || null,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to persist search query log', error);
  }
};

const computePeopleAnalytics = (records, total) => {
  const locationCounts = new Map();
  const skillCounts = new Map();
  const tagCounts = new Map();

  records.forEach((profile) => {
    incrementCount(locationCounts, profile.location);
    (profile.skills || []).forEach((skill) => incrementCount(skillCounts, skill.name));
    (profile.tags || []).forEach((tag) => incrementCount(tagCounts, tag.name));
  });

  return {
    total_results: total,
    top_locations: summariseMap(locationCounts),
    top_skills: summariseMap(skillCounts),
    top_tags: summariseMap(tagCounts),
  };
};

const computeFreelancerAnalytics = (records, total) => {
  const availabilityCounts = new Map();
  const locationCounts = new Map();
  const skillCounts = new Map();

  records.forEach((freelancer) => {
    incrementCount(availabilityCounts, freelancer.availability_status);
    const profile = freelancer.profile || {};
    incrementCount(locationCounts, profile.location);
    (profile.skills || []).forEach((skill) => incrementCount(skillCounts, skill.name));
  });

  return {
    total_results: total,
    availability_breakdown: summariseMap(availabilityCounts),
    top_locations: summariseMap(locationCounts),
    top_skills: summariseMap(skillCounts),
  };
};

const computeAgencyAnalytics = (records, total) => {
  const locationCounts = new Map();
  const specialtyCounts = new Map();

  records.forEach((agency) => {
    incrementCount(locationCounts, agency.location);
    (agency.specialties || []).forEach((specialty) => incrementCount(specialtyCounts, specialty));
  });

  return {
    total_results: total,
    top_locations: summariseMap(locationCounts),
    top_specialties: summariseMap(specialtyCounts),
  };
};

const computeCompanyAnalytics = (records, total) => {
  const industryCounts = new Map();
  const sizeCounts = new Map();
  const headquartersCounts = new Map();

  records.forEach((company) => {
    incrementCount(industryCounts, company.industry);
    incrementCount(sizeCounts, company.size);
    incrementCount(headquartersCounts, company.headquarters);
  });

  return {
    total_results: total,
    top_industries: summariseMap(industryCounts),
    size_distribution: summariseMap(sizeCounts),
    top_headquarters: summariseMap(headquartersCounts),
  };
};

const computeEntityAnalytics = (records, total) => {
  const tagCounts = new Map();
  const statusCounts = new Map();

  records.forEach((entity) => {
    incrementCount(statusCounts, entity.status);
    (entity.tags || []).forEach((tag) => incrementCount(tagCounts, tag));
  });

  return {
    total_results: total,
    top_tags: summariseMap(tagCounts),
    status_breakdown: summariseMap(statusCounts),
  };
};

const computeJobAnalytics = (records, total) => {
  const locationCounts = new Map();
  const jobTypeCounts = new Map();
  const tagCounts = new Map();

  records.forEach((job) => {
    incrementCount(locationCounts, job.location);
    incrementCount(jobTypeCounts, job.job_type);
    (job.tags || []).forEach((tag) => incrementCount(tagCounts, tag));
  });

  return {
    total_results: total,
    top_locations: summariseMap(locationCounts),
    job_type_breakdown: summariseMap(jobTypeCounts),
    top_tags: summariseMap(tagCounts),
  };
};

const computeGroupAnalytics = (records, total) => {
  const tagCounts = new Map();

  records.forEach((group) => {
    (group.tags || []).forEach((tag) => incrementCount(tagCounts, tag.name));
  });

  return {
    total_results: total,
    top_tags: summariseMap(tagCounts),
  };
};

const searchPeople = async (context) => {
  const {
    query,
    pagination,
    includeDeleted,
    analyticsRequested,
    skills,
    tags,
    expand,
    fields,
    location,
  } = context;

  const op = likeOperator();
  const where = {};

  if (query) {
    const pattern = `%${query.toLowerCase()}%`;
    where[Op.or] = [
      sequelize.where(lowerColumn('Profile.display_name'), { [op]: pattern }),
      sequelize.where(lowerColumn('Profile.headline'), { [op]: pattern }),
      sequelize.where(lowerColumn('Profile.bio'), { [op]: pattern }),
    ];
  }

  if (location) {
    const pattern = `%${location.toLowerCase()}%`;
    where[Op.and] = [
      ...(where[Op.and] || []),
      sequelize.where(lowerColumn('Profile.location'), { [op]: pattern }),
    ];
  }

  if (pagination.cursorValue !== undefined) {
    where[pagination.sortField] = {
      ...(where[pagination.sortField] || {}),
      [pagination.cursorOperator]: pagination.cursorValue,
    };
  }

  const include = [];

  const skillsInclude = {
    model: Skill,
    as: 'skills',
    attributes: ['id', 'name'],
    through: { attributes: [] },
    required: false,
  };

  if (skills.length) {
    skillsInclude.where = { name: { [Op.in]: skills } };
    skillsInclude.required = true;
  }
  if (skills.length || analyticsRequested || expand.has('skills')) {
    include.push(skillsInclude);
  }

  const tagsInclude = {
    model: Tag,
    as: 'tags',
    attributes: ['id', 'name'],
    through: { attributes: [] },
    required: false,
  };

  if (tags.length) {
    tagsInclude.where = { name: { [Op.in]: tags } };
    tagsInclude.required = true;
  }
  if (tags.length || analyticsRequested || expand.has('tags')) {
    include.push(tagsInclude);
  }

  if (expand.has('user')) {
    include.push({
      model: User,
      as: 'user',
      attributes: ['id', 'email', 'role', 'is_verified', 'status'],
    });
  }

  if (expand.has('freelancer_overlay') || analyticsRequested) {
    include.push({
      model: FreelancerProfile,
      as: 'freelancer_overlay',
      attributes: ['id', 'headline', 'availability_status', 'available_hours_per_week', 'verified_at'],
    });
  }

  if (expand.has('portfolio')) {
    include.push({ association: 'portfolio' });
  }

  if (expand.has('reviews')) {
    include.push({ association: 'reviews' });
  }

  const allowedFields = new Set([
    'id',
    'display_name',
    'headline',
    'bio',
    'location',
    'avatar_url',
    'banner_url',
    'hourly_rate',
    'currency',
    'analytics_snapshot',
    'created_at',
    'updated_at',
    'deleted_at',
  ]);

  const attributes = fields.size
    ? Array.from(new Set([...fields].filter((field) => allowedFields.has(field)).concat(['id', pagination.sortField])))
    : ['id', 'display_name', 'headline', 'location', 'avatar_url', 'hourly_rate', 'currency', 'created_at', 'updated_at'];

  const result = await Profile.findAndCountAll({
    where,
    include,
    limit: pagination.limit + 1,
    order: pagination.order,
    paranoid: !includeDeleted,
    distinct: true,
    col: 'Profile.id',
    subQuery: false,
    attributes,
  });

  const envelope = buildPaginationEnvelope(result.rows, pagination, result.count);

  let analytics;
  if (analyticsRequested) {
    analytics = computePeopleAnalytics(envelope.data, envelope.total);
  }

  return { ...envelope, analytics };
};

const searchFreelancers = async (context) => {
  const {
    query,
    pagination,
    includeDeleted,
    analyticsRequested,
    skills,
    tags,
    expand,
    fields,
    location,
  } = context;

  const op = likeOperator();
  const where = {};

  if (query) {
    const pattern = `%${query.toLowerCase()}%`;
    where[Op.or] = [
      sequelize.where(lowerColumn('FreelancerProfile.headline'), { [op]: pattern }),
      sequelize.where(lowerColumn('profile.display_name'), { [op]: pattern }),
      sequelize.where(lowerColumn('profile.bio'), { [op]: pattern }),
    ];
  }

  if (pagination.cursorValue !== undefined) {
    where[pagination.sortField] = {
      ...(where[pagination.sortField] || {}),
      [pagination.cursorOperator]: pagination.cursorValue,
    };
  }

  const profileInclude = {
    model: Profile,
    as: 'profile',
    required: true,
    attributes: ['id', 'display_name', 'headline', 'bio', 'location', 'avatar_url', 'hourly_rate', 'currency'],
    include: [],
    paranoid: !includeDeleted,
  };

  if (location) {
    const pattern = `%${location.toLowerCase()}%`;
    profileInclude.where = {
      ...(profileInclude.where || {}),
      [Op.and]: [
        ...(profileInclude.where?.[Op.and] || []),
        sequelize.where(lowerColumn('profile.location'), { [op]: pattern }),
      ],
    };
  }

  const skillsInclude = {
    model: Skill,
    as: 'skills',
    attributes: ['id', 'name'],
    through: { attributes: [] },
    required: false,
  };

  if (skills.length) {
    skillsInclude.where = { name: { [Op.in]: skills } };
    skillsInclude.required = true;
  }
  if (skills.length || analyticsRequested || expand.has('profile.skills')) {
    profileInclude.include.push(skillsInclude);
  }

  const tagsInclude = {
    model: Tag,
    as: 'tags',
    attributes: ['id', 'name'],
    through: { attributes: [] },
    required: false,
  };

  if (tags.length) {
    tagsInclude.where = { name: { [Op.in]: tags } };
    tagsInclude.required = true;
  }
  if (tags.length || analyticsRequested || expand.has('profile.tags')) {
    profileInclude.include.push(tagsInclude);
  }

  if (expand.has('profile.portfolio')) {
    profileInclude.include.push({ association: 'portfolio' });
  }

  if (expand.has('profile.reviews')) {
    profileInclude.include.push({ association: 'reviews' });
  }

  const include = [profileInclude];

  const allowedFields = new Set([
    'id',
    'profile_id',
    'headline',
    'specialties',
    'availability_status',
    'available_hours_per_week',
    'languages',
    'rate_card',
    'certifications',
    'verified_at',
    'created_at',
    'updated_at',
    'deleted_at',
  ]);

  const attributes = fields.size
    ? Array.from(new Set([...fields].filter((field) => allowedFields.has(field)).concat(['id', pagination.sortField])))
    : [
        'id',
        'profile_id',
        'headline',
        'specialties',
        'availability_status',
        'available_hours_per_week',
        'verified_at',
        'created_at',
        'updated_at',
      ];

  const result = await FreelancerProfile.findAndCountAll({
    where,
    include,
    limit: pagination.limit + 1,
    order: pagination.order,
    paranoid: !includeDeleted,
    distinct: true,
    col: 'FreelancerProfile.id',
    subQuery: false,
    attributes,
  });

  const envelope = buildPaginationEnvelope(result.rows, pagination, result.count, (item) => ({
    ...item,
    tags: item.profile?.tags,
    skills: item.profile?.skills,
  }));

  let analytics;
  if (analyticsRequested) {
    analytics = computeFreelancerAnalytics(envelope.data, envelope.total);
  }

  return { ...envelope, analytics };
};

const applyJsonArrayFilters = (where, column, values) => {
  if (!values.length) return;
  const op = likeOperator();
  values.forEach((value) => {
    const pattern = `%${value.toLowerCase()}%`;
    where[Op.and] = [
      ...(where[Op.and] || []),
      sequelize.where(lowerColumn(column, { json: true }), { [op]: pattern }),
    ];
  });
};

const searchAgencies = async (context) => {
  const { query, pagination, includeDeleted, analyticsRequested, skills, tags, expand, fields, location } = context;
  const op = likeOperator();
  const where = {};

  if (query) {
    const pattern = `%${query.toLowerCase()}%`;
    where[Op.or] = [
      sequelize.where(lowerColumn('Agency.name'), { [op]: pattern }),
      sequelize.where(lowerColumn('Agency.description'), { [op]: pattern }),
      sequelize.where(lowerColumn('Agency.services', { json: true }), { [op]: pattern }),
      sequelize.where(lowerColumn('Agency.specialties', { json: true }), { [op]: pattern }),
    ];
  }

  if (location) {
    const pattern = `%${location.toLowerCase()}%`;
    where[Op.and] = [
      ...(where[Op.and] || []),
      sequelize.where(lowerColumn('Agency.location'), { [op]: pattern }),
    ];
  }

  applyJsonArrayFilters(where, 'Agency.specialties', skills);
  applyJsonArrayFilters(where, 'Agency.specialties', tags);

  if (pagination.cursorValue !== undefined) {
    where[pagination.sortField] = {
      ...(where[pagination.sortField] || {}),
      [pagination.cursorOperator]: pagination.cursorValue,
    };
  }

  const include = [];
  if (expand.has('owner')) {
    include.push({ model: User, as: 'owner', attributes: ['id', 'email', 'role'] });
  }
  if (expand.has('teamMembers')) {
    include.push({ association: 'teamMembers', attributes: ['id', 'email'], through: { attributes: [] } });
  }

  const allowedFields = new Set([
    'id',
    'name',
    'slug',
    'description',
    'website',
    'services',
    'specialties',
    'location',
    'verified',
    'verified_at',
    'logo_url',
    'banner_url',
    'metadata',
    'analytics_snapshot',
    'created_at',
    'updated_at',
    'deleted_at',
  ]);

  const attributes = fields.size
    ? Array.from(new Set([...fields].filter((field) => allowedFields.has(field)).concat(['id', pagination.sortField])))
    : [
        'id',
        'name',
        'slug',
        'description',
        'website',
        'services',
        'specialties',
        'location',
        'verified',
        'logo_url',
        'banner_url',
        'created_at',
        'updated_at',
      ];

  const result = await Agency.findAndCountAll({
    where,
    include,
    limit: pagination.limit + 1,
    order: pagination.order,
    paranoid: !includeDeleted,
    distinct: true,
    col: 'Agency.id',
    subQuery: false,
    attributes,
  });

  const envelope = buildPaginationEnvelope(result.rows, pagination, result.count);
  let analytics;
  if (analyticsRequested) {
    analytics = computeAgencyAnalytics(envelope.data, envelope.total);
  }

  return { ...envelope, analytics };
};

const searchCompanies = async (context) => {
  const { query, pagination, includeDeleted, analyticsRequested, tags, expand, fields, location, skills } = context;
  const op = likeOperator();
  const where = {};

  if (query) {
    const pattern = `%${query.toLowerCase()}%`;
    where[Op.or] = [
      sequelize.where(lowerColumn('Company.name'), { [op]: pattern }),
      sequelize.where(lowerColumn('Company.description'), { [op]: pattern }),
      sequelize.where(lowerColumn('Company.industry'), { [op]: pattern }),
    ];
  }

  if (location) {
    const pattern = `%${location.toLowerCase()}%`;
    where[Op.and] = [
      ...(where[Op.and] || []),
      sequelize.where(lowerColumn('Company.headquarters'), { [op]: pattern }),
    ];
  }

  [...skills, ...tags].forEach((value) => {
    const pattern = `%${value.toLowerCase()}%`;
    where[Op.and] = [
      ...(where[Op.and] || []),
      sequelize.where(lowerColumn('Company.metadata', { json: true }), { [op]: pattern }),
    ];
  });

  if (pagination.cursorValue !== undefined) {
    where[pagination.sortField] = {
      ...(where[pagination.sortField] || {}),
      [pagination.cursorOperator]: pagination.cursorValue,
    };
  }

  const include = [];
  if (expand.has('owner')) {
    include.push({ model: User, as: 'owner', attributes: ['id', 'email', 'role'] });
  }
  if (expand.has('teamMembers')) {
    include.push({ association: 'teamMembers', attributes: ['id', 'email'], through: { attributes: [] } });
  }

  const allowedFields = new Set([
    'id',
    'name',
    'slug',
    'description',
    'website',
    'industry',
    'size',
    'headquarters',
    'verified',
    'verified_at',
    'logo_url',
    'banner_url',
    'metadata',
    'analytics_snapshot',
    'created_at',
    'updated_at',
    'deleted_at',
  ]);

  const attributes = fields.size
    ? Array.from(new Set([...fields].filter((field) => allowedFields.has(field)).concat(['id', pagination.sortField])))
    : [
        'id',
        'name',
        'slug',
        'description',
        'website',
        'industry',
        'size',
        'headquarters',
        'verified',
        'logo_url',
        'banner_url',
        'created_at',
        'updated_at',
      ];

  const result = await Company.findAndCountAll({
    where,
    include,
    limit: pagination.limit + 1,
    order: pagination.order,
    paranoid: !includeDeleted,
    distinct: true,
    col: 'Company.id',
    subQuery: false,
    attributes,
  });

  const envelope = buildPaginationEnvelope(result.rows, pagination, result.count);
  let analytics;
  if (analyticsRequested) {
    analytics = computeCompanyAnalytics(envelope.data, envelope.total);
  }

  return { ...envelope, analytics };
};

const searchDiscoverEntities = async (context, entityType) => {
  const { query, pagination, analyticsRequested, tags, fields, includeDeleted, location, skills } = context;
  const op = likeOperator();
  const where = { type: entityType };

  if (query) {
    const pattern = `%${query.toLowerCase()}%`;
    where[Op.or] = [
      sequelize.where(lowerColumn('DiscoverEntity.title'), { [op]: pattern }),
      sequelize.where(lowerColumn('DiscoverEntity.subtitle'), { [op]: pattern }),
      sequelize.where(lowerColumn('DiscoverEntity.search_terms'), { [op]: pattern }),
    ];
  }

  const combinedTags = [...tags];
  if (skills.length) {
    combinedTags.push(...skills);
  }

  if (combinedTags.length) {
    combinedTags.forEach((tag) => {
      const pattern = `%${tag.toLowerCase()}%`;
      where[Op.and] = [
        ...(where[Op.and] || []),
        sequelize.where(lowerColumn('DiscoverEntity.search_terms'), { [op]: pattern }),
      ];
    });
  }

  if (location) {
    const pattern = `%${location.toLowerCase()}%`;
    where[Op.and] = [
      ...(where[Op.and] || []),
      sequelize.where(lowerColumn('DiscoverEntity.search_terms'), { [op]: pattern }),
    ];
  }

  if (pagination.cursorValue !== undefined) {
    where[pagination.sortField] = {
      ...(where[pagination.sortField] || {}),
      [pagination.cursorOperator]: pagination.cursorValue,
    };
  }

  const allowedFields = new Set([
    'id',
    'type',
    'slug',
    'title',
    'subtitle',
    'description',
    'image_url',
    'metadata',
    'tags',
    'metrics',
    'relevance_score',
    'status',
    'starts_at',
    'ends_at',
    'created_at',
    'updated_at',
  ]);

  const attributes = fields.size
    ? Array.from(new Set([...fields].filter((field) => allowedFields.has(field)).concat(['id', pagination.sortField])))
    : [
        'id',
        'type',
        'slug',
        'title',
        'subtitle',
        'description',
        'image_url',
        'metadata',
        'tags',
        'metrics',
        'relevance_score',
        'status',
        'starts_at',
        'ends_at',
        'created_at',
        'updated_at',
      ];

  const result = await DiscoverEntity.findAndCountAll({
    where,
    limit: pagination.limit + 1,
    order: pagination.order,
    paranoid: !includeDeleted,
    distinct: true,
    col: 'DiscoverEntity.id',
    attributes,
  });

  const envelope = buildPaginationEnvelope(result.rows, pagination, result.count);
  let analytics;
  if (analyticsRequested) {
    analytics = computeEntityAnalytics(envelope.data, envelope.total);
  }

  return { ...envelope, analytics };
};

const searchJobs = async (context) => {
  const { query, pagination, includeDeleted, analyticsRequested, tags, fields, location, skills, expand } = context;
  const op = likeOperator();
  const where = {};

  if (query) {
    const pattern = `%${query.toLowerCase()}%`;
    where[Op.or] = [
      sequelize.where(lowerColumn('Job.title'), { [op]: pattern }),
      sequelize.where(lowerColumn('Job.description'), { [op]: pattern }),
    ];
  }

  if (location) {
    const pattern = `%${location.toLowerCase()}%`;
    where[Op.and] = [
      ...(where[Op.and] || []),
      sequelize.where(lowerColumn('Job.location'), { [op]: pattern }),
    ];
  }

  if (pagination.cursorValue !== undefined) {
    where[pagination.sortField] = {
      ...(where[pagination.sortField] || {}),
      [pagination.cursorOperator]: pagination.cursorValue,
    };
  }

  const tagValues = [...tags, ...skills];

  const include = [];
  if (tagValues.length || analyticsRequested || expand.has('tags')) {
    include.push({
      model: JobTag,
      as: 'tagAssignments',
      attributes: ['id', 'tag'],
      where: tagValues.length ? { tag: { [Op.in]: tagValues } } : undefined,
      required: tagValues.length > 0,
    });
  }

  if (expand.has('owner')) {
    include.push({ model: User, as: 'owner', attributes: ['id', 'email', 'role'] });
  }

  if (expand.has('company')) {
    include.push({ model: User, as: 'company', attributes: ['id', 'email', 'role'] });
  }

  const allowedFields = new Set([
    'id',
    'title',
    'slug',
    'description',
    'location',
    'job_type',
    'salary_min',
    'salary_max',
    'salary_currency',
    'status',
    'published_at',
    'closes_at',
    'views_count',
    'applications_count',
    'hires_count',
    'metadata',
    'created_at',
    'updated_at',
    'deleted_at',
  ]);

  const attributes = fields.size
    ? Array.from(new Set([...fields].filter((field) => allowedFields.has(field)).concat(['id', pagination.sortField])))
    : [
        'id',
        'title',
        'slug',
        'description',
        'location',
        'job_type',
        'salary_min',
        'salary_max',
        'salary_currency',
        'status',
        'published_at',
        'closes_at',
        'created_at',
        'updated_at',
      ];

  const result = await Job.findAndCountAll({
    where,
    include,
    limit: pagination.limit + 1,
    order: pagination.order,
    paranoid: !includeDeleted,
    distinct: true,
    col: 'Job.id',
    subQuery: false,
    attributes,
  });

  const envelope = buildPaginationEnvelope(result.rows, pagination, result.count, (item) => ({
    ...item,
    tags: (item.tagAssignments || []).map((entry) => entry.tag),
  }));

  let analytics;
  if (analyticsRequested) {
    analytics = computeJobAnalytics(envelope.data, envelope.total);
  }

  return { ...envelope, analytics };
};

const searchGroups = async (context) => {
  const { query, pagination, includeDeleted, analyticsRequested, tags, fields, expand } = context;
  const op = likeOperator();
  const where = {};

  if (query) {
    const pattern = `%${query.toLowerCase()}%`;
    where[Op.or] = [
      sequelize.where(lowerColumn('Group.name'), { [op]: pattern }),
      sequelize.where(lowerColumn('Group.description'), { [op]: pattern }),
    ];
  }

  if (pagination.cursorValue !== undefined) {
    where[pagination.sortField] = {
      ...(where[pagination.sortField] || {}),
      [pagination.cursorOperator]: pagination.cursorValue,
    };
  }

  const include = [];
  if (tags.length || analyticsRequested || expand.has('tags')) {
    include.push({
      model: Tag,
      as: 'tags',
      attributes: ['id', 'name'],
      through: { attributes: [] },
      where: tags.length ? { name: { [Op.in]: tags } } : undefined,
      required: tags.length > 0,
    });
  }

  if (expand.has('owner')) {
    include.push({ model: User, as: 'owner', attributes: ['id', 'email'] });
  }

  if (expand.has('members')) {
    include.push({ association: 'members', attributes: ['id', 'email'], through: { attributes: [] } });
  }

  const allowedFields = new Set([
    'id',
    'name',
    'slug',
    'description',
    'visibility',
    'cover_image_url',
    'metadata',
    'created_by',
    'created_at',
    'updated_at',
    'deleted_at',
  ]);

  const attributes = fields.size
    ? Array.from(new Set([...fields].filter((field) => allowedFields.has(field)).concat(['id', pagination.sortField])))
    : ['id', 'name', 'slug', 'description', 'visibility', 'cover_image_url', 'created_by', 'created_at', 'updated_at'];

  const result = await Group.findAndCountAll({
    where,
    include,
    limit: pagination.limit + 1,
    order: pagination.order,
    paranoid: !includeDeleted,
    distinct: true,
    col: 'Group.id',
    subQuery: false,
    attributes,
  });

  const envelope = buildPaginationEnvelope(result.rows, pagination, result.count);
  let analytics;
  if (analyticsRequested) {
    analytics = computeGroupAnalytics(envelope.data, envelope.total);
  }

  return { ...envelope, analytics };
};

const searchHandlers = {
  people: (context) => searchPeople(context),
  freelancers: (context) => searchFreelancers(context),
  agencies: (context) => searchAgencies(context),
  companies: (context) => searchCompanies(context),
  projects: (context) => searchDiscoverEntities(context, 'projects'),
  gigs: (context) => searchDiscoverEntities(context, 'gigs'),
  jobs: (context) => searchJobs(context),
  groups: (context) => searchGroups(context),
};

const allowedSortFields = {
  people: ['created_at', 'updated_at'],
  freelancers: ['created_at', 'updated_at'],
  agencies: ['created_at', 'updated_at', 'name'],
  companies: ['created_at', 'updated_at', 'name'],
  projects: ['relevance_score', 'starts_at', 'created_at'],
  gigs: ['relevance_score', 'starts_at', 'created_at'],
  jobs: ['published_at', 'created_at', 'updated_at'],
  groups: ['created_at', 'updated_at', 'name'],
};

const search = async (params, currentUser, requestMeta = {}) => {
  const searchType = params.type || 'people';
  if (!SEARCH_TYPES.includes(searchType)) {
    throw new ApiError(400, 'Invalid search type requested', 'INVALID_SEARCH_TYPE');
  }

  const skills = toArray(params.skills);
  const tags = toArray(params.tags);
  const fields = new Set(toArray(params.fields));
  const expand = new Set(toArray(params.expand));
  const include = new Set(toArray(params.include));
  const includeDeleted = include.has('deleted') && currentUser?.role === 'admin';
  const analyticsRequested = params.analytics === true || params.analytics === 'true';

  const pagination = buildPagination(params, allowedSortFields[searchType]);

  const started = Date.now();
  const handler = searchHandlers[searchType];
  const result = await handler({
    query: params.q ? String(params.q) : '',
    pagination,
    includeDeleted,
    analyticsRequested,
    skills,
    tags,
    fields,
    expand,
    location: params.location ? String(params.location) : '',
  });
  const duration = Date.now() - started;

  await logSearchQuery({
    query: params.q ? String(params.q) : null,
    searchType,
    filters: { location: params.location || null, skills, tags },
    resultsCount: result.total,
    analyticsSnapshot: analyticsRequested ? result.analytics : null,
    duration,
    user: currentUser,
    requestMeta,
  });

  return {
    type: searchType,
    took_ms: duration,
    ...result,
  };
};

const getSuggestions = async (params) => {
  const suggestionType = params.type || 'skills';
  const limit = Math.min(params.limit || 10, 25);
  const query = params.q ? String(params.q).trim().toLowerCase() : '';
  const op = likeOperator();
  const pattern = query ? `%${query}%` : null;

  if (!['skills', 'tags', 'titles', 'companies'].includes(suggestionType)) {
    throw new ApiError(400, 'Unsupported suggestion type', 'INVALID_SUGGESTION_TYPE');
  }

  if (suggestionType === 'skills') {
    const skills = await Skill.findAll({
      where: pattern ? { name: { [op]: pattern } } : undefined,
      order: [['name', 'ASC']],
      limit,
    });
    return { data: skills.map((skill) => ({ id: skill.id, label: skill.name, type: 'skill' })) };
  }

  if (suggestionType === 'tags') {
    const tags = await Tag.findAll({
      where: pattern ? { name: { [op]: pattern } } : undefined,
      order: [['name', 'ASC']],
      limit,
    });
    return { data: tags.map((tag) => ({ id: tag.id, label: tag.name, type: 'tag' })) };
  }

  if (suggestionType === 'companies') {
    const companies = await Company.findAll({
      where: pattern
        ? {
            [Op.or]: [
              { name: { [op]: pattern } },
              { industry: { [op]: pattern } },
            ],
          }
        : undefined,
      order: [['name', 'ASC']],
      limit,
      attributes: ['id', 'name', 'industry'],
    });
    return {
      data: companies.map((company) => ({
        id: company.id,
        label: company.name,
        meta: { industry: company.industry },
        type: 'company',
      })),
    };
  }

  const jobTitles = await Job.findAll({
    where: pattern ? { title: { [op]: pattern } } : undefined,
    attributes: [[fn('DISTINCT', col('title')), 'title']],
    order: [[fn('LOWER', col('title')), 'ASC']],
    limit,
    raw: true,
  });

  const discoverTitles = await DiscoverEntity.findAll({
    where: {
      type: 'jobs',
      ...(pattern
        ? {
            [Op.or]: [
              sequelize.where(lowerColumn('DiscoverEntity.title'), { [op]: pattern }),
              sequelize.where(lowerColumn('DiscoverEntity.subtitle'), { [op]: pattern }),
            ],
          }
        : {}),
    },
    attributes: ['title'],
    order: [['title', 'ASC']],
    limit,
    raw: true,
  });

  const seen = new Set();
  const results = [];
  [...jobTitles, ...discoverTitles].some((entry) => {
    const title = entry.title;
    if (!title) return false;
    const key = title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    results.push({ label: title, type: 'title' });
    return results.length >= limit;
  });

  return { data: results.slice(0, limit) };
};

const listHistory = async (params, currentUser) => {
  const searchType = params.type;
  if (searchType && !SEARCH_TYPES.includes(searchType)) {
    throw new ApiError(400, 'Invalid search type requested', 'INVALID_SEARCH_TYPE');
  }
  const include = new Set(toArray(params.include));
  const expand = new Set(toArray(params.expand));
  const analyticsRequested = params.analytics === true || params.analytics === 'true';
  const includeDeleted = include.has('deleted') && currentUser?.role === 'admin';
  const pagination = buildPagination(params, HISTORY_SORT_FIELDS);
  const where = {};

  if (searchType) {
    where.search_type = searchType;
  }

  if (!currentUser || currentUser.role !== 'admin') {
    where.user_id = currentUser?.id || null;
  } else if (params.user_id) {
    where.user_id = params.user_id;
  }

  if (params.q) {
    const pattern = `%${String(params.q).toLowerCase()}%`;
    where[Op.or] = [
      sequelize.where(lowerColumn('SearchQuery.query'), { [likeOperator()]: pattern }),
      sequelize.where(lowerColumn('SearchQuery.filters', { json: true }), { [likeOperator()]: pattern }),
    ];
  }

  if (pagination.cursorValue !== undefined) {
    where[pagination.sortField] = {
      ...(where[pagination.sortField] || {}),
      [pagination.cursorOperator]: pagination.cursorValue,
    };
  }

  const includeModels = [];
  if (expand.has('user') && currentUser?.role === 'admin') {
    includeModels.push({ model: User, as: 'user', attributes: ['id', 'email', 'role'] });
  }

  const result = await SearchQuery.findAndCountAll({
    where,
    include: includeModels,
    limit: pagination.limit + 1,
    order: pagination.order,
    paranoid: !includeDeleted,
    distinct: true,
    col: 'SearchQuery.id',
    subQuery: false,
  });

  const envelope = buildPaginationEnvelope(result.rows, pagination, result.count);

  let analytics;
  if (analyticsRequested) {
    const counts = await SearchQuery.findAll({
      attributes: ['search_type', [fn('COUNT', '*'), 'count']],
      where,
      paranoid: !includeDeleted,
      group: ['search_type'],
      raw: true,
    });
    analytics = {
      total_queries: envelope.total,
      counts_by_type: counts.map((entry) => ({ type: entry.search_type, count: Number(entry.count) })),
      last_query_at: envelope.data.length ? envelope.data[0].executed_at : null,
    };
  }

  return { ...envelope, analytics };
};

const findOwnedQuery = async (id, currentUser, { includeDeleted = false } = {}) => {
  const entry = await SearchQuery.findByPk(id, { paranoid: !includeDeleted });
  if (!entry) {
    throw new ApiError(404, 'Search history entry not found', 'SEARCH_HISTORY_NOT_FOUND');
  }
  if (entry.user_id && currentUser.role !== 'admin' && entry.user_id !== currentUser.id) {
    throw new ApiError(403, 'You do not have permission to modify this entry', 'FORBIDDEN');
  }
  return entry;
};

const removeHistory = async (id, currentUser) => {
  const entry = await findOwnedQuery(id, currentUser);
  await entry.destroy();
  return { success: true };
};

const restoreHistory = async (id, currentUser) => {
  const entry = await findOwnedQuery(id, currentUser, { includeDeleted: true });
  if (!entry.deleted_at) {
    return { success: true };
  }
  await entry.restore();
  return { success: true };
};

module.exports = {
  search,
  getSuggestions,
  listHistory,
  removeHistory,
  restoreHistory,
};
