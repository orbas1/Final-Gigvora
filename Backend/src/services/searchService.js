const { Op, fn, col } = require('sequelize');
const {
  sequelize,
  Profile,
  User,
  Skill,
  Tag,
  Organization,
  Project,
  Gig,
  Job,
  Group,
} = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { buildPagination, encodeCursor } = require('../utils/pagination');

const SUPPORTED_TYPES = [
  'people',
  'freelancers',
  'agencies',
  'companies',
  'projects',
  'gigs',
  'jobs',
  'groups',
];

const parseStringList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((entry) => (entry === undefined || entry === null ? null : String(entry)))
      .filter(Boolean);
  }
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const toLowerList = (values) => values.map((value) => String(value).toLowerCase());

const extractListColumn = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const applySearchTerm = (where, fields, term) => {
  if (!term) return;
  const normalized = `%${term.toLowerCase()}%`;
  const orConditions = fields.map((field) =>
    sequelize.where(fn('lower', col(field)), { [Op.like]: normalized })
  );
  where[Op.and] = [...(where[Op.and] || []), { [Op.or]: orConditions }];
};

const applyTextListFilter = (where, field, values) => {
  if (!values.length) return;
  const conditions = values.map((value) =>
    sequelize.where(fn('lower', col(field)), { [Op.like]: `%${value}%` })
  );
  where[Op.and] = [...(where[Op.and] || []), ...conditions];
};

const addCursorCondition = (where, pagination) => {
  if (pagination.cursorValue === undefined || pagination.cursorValue === null) return;
  where[pagination.sortField] = {
    ...(where[pagination.sortField] || {}),
    [pagination.cursorOperator]: pagination.cursorValue,
  };
};

const normalizeParams = (query, currentUser) => {
  const expandSet = new Set(parseStringList(query.expand).map((value) => value.toLowerCase()));
  const includeSet = new Set(parseStringList(query.include).map((value) => value.toLowerCase()));

  return {
    ...query,
    type: query.type || 'people',
    q: query.q ? String(query.q).trim() : undefined,
    location: query.location ? String(query.location).trim() : undefined,
    skills: toLowerList(query.skills || []),
    tags: toLowerList(query.tags || []),
    expand: expandSet,
    include: includeSet,
    includeDeleted: includeSet.has('deleted') && currentUser?.role === 'admin',
    analytics: Boolean(query.analytics),
    fields: query.fields || [],
  };
};

const userRoleFilter = (entityType) => {
  const base = { role: { [Op.ne]: 'admin' } };
  if (entityType === 'freelancer') {
    return {
      [Op.and]: [
        base,
        {
          [Op.or]: [
            { role: 'freelancer' },
            { active_role: 'freelancer' },
          ],
        },
      ],
    };
  }
  return base;
};

const buildPeopleQuery = (params, entityType) => {
  const where = {};
  applySearchTerm(where, ['Profile.display_name', 'Profile.headline', 'Profile.bio'], params.q);
  if (params.location) {
    applyTextListFilter(where, 'Profile.location', [params.location.toLowerCase()]);
  }

  const include = [
    {
      model: User,
      as: 'user',
      attributes: ['id', 'email', 'role', 'active_role', 'is_verified', 'status', 'last_login_at'],
      required: true,
      where: userRoleFilter(entityType),
    },
  ];

  if (params.skills.length) {
    include.push({
      model: Skill,
      as: 'skills',
      attributes: ['id', 'name'],
      through: { attributes: [] },
      required: true,
      where: {
        [Op.or]: params.skills.map((skill) =>
          sequelize.where(fn('lower', col('skills.name')), { [Op.eq]: skill })
        ),
      },
    });
  } else if (params.expand.has('skills')) {
    include.push({
      model: Skill,
      as: 'skills',
      attributes: ['id', 'name'],
      through: { attributes: [] },
      required: false,
    });
  }

  if (params.tags.length) {
    include.push({
      model: Tag,
      as: 'tags',
      attributes: ['id', 'name'],
      through: { attributes: [] },
      required: true,
      where: {
        [Op.or]: params.tags.map((tag) =>
          sequelize.where(fn('lower', col('tags.name')), { [Op.eq]: tag })
        ),
      },
    });
  } else if (params.expand.has('tags')) {
    include.push({
      model: Tag,
      as: 'tags',
      attributes: ['id', 'name'],
      through: { attributes: [] },
      required: false,
    });
  }

  return { where, include, paranoid: !params.includeDeleted };
};

const formatPeopleData = (rows, entityType) =>
  rows.map((row) => {
    const json = row.toJSON();
    const skills = (json.skills || []).map((skill) => ({ id: skill.id, name: skill.name }));
    const tags = (json.tags || []).map((tag) => ({ id: tag.id, name: tag.name }));
    return {
      entity_type: entityType === 'freelancer' ? 'freelancer' : 'person',
      id: json.user_id,
      profile: {
        id: json.id,
        user_id: json.user_id,
        display_name: json.display_name,
        headline: json.headline,
        bio: json.bio,
        location: json.location,
        hourly_rate: json.hourly_rate,
        currency: json.currency,
        analytics_snapshot: json.analytics_snapshot,
        created_at: json.created_at,
        updated_at: json.updated_at,
        skills,
        tags,
      },
      user: json.user,
    };
  });

const searchPeople = async (params, entityType) => {
  const pagination = buildPagination(params, ['created_at', 'updated_at', 'display_name']);
  const query = buildPeopleQuery(params, entityType);
  addCursorCondition(query.where, pagination);

  const { rows, count } = await Profile.findAndCountAll({
    where: query.where,
    include: query.include,
    paranoid: query.paranoid,
    attributes: [
      'id',
      'user_id',
      'display_name',
      'headline',
      'bio',
      'location',
      'hourly_rate',
      'currency',
      'analytics_snapshot',
      'created_at',
      'updated_at',
    ],
    limit: pagination.limit + 1,
    order: pagination.order,
    distinct: true,
    col: 'Profile.id',
  });

  const hasMore = rows.length > pagination.limit;
  const sliced = hasMore ? rows.slice(0, pagination.limit) : rows;
  const data = formatPeopleData(sliced, entityType);
  const cursorSource = hasMore ? sliced[sliced.length - 1] : null;
  const nextCursor = cursorSource ? encodeCursor(cursorSource.get(pagination.sortField)) : null;

  return {
    data,
    total: typeof count === 'number' ? count : Array.isArray(count) ? count.length : 0,
    page: {
      next_cursor: nextCursor,
      limit: pagination.limit,
    },
  };
};

const countPeople = async (params, entityType) => {
  const query = buildPeopleQuery(params, entityType);
  return Profile.count({
    where: query.where,
    include: query.include,
    paranoid: query.paranoid,
    distinct: true,
    col: 'Profile.id',
  });
};

const buildOrganizationQuery = (params, type) => {
  const where = { type };
  applySearchTerm(where, ['Organization.name', 'Organization.headline', 'Organization.description'], params.q);
  if (params.location) {
    applyTextListFilter(where, 'Organization.location', [params.location.toLowerCase()]);
  }
  if (params.tags.length) {
    applyTextListFilter(where, 'Organization.tags', params.tags);
  }

  return { where, include: [], paranoid: !params.includeDeleted };
};

const searchOrganizations = async (params, type) => {
  const pagination = buildPagination(params, ['created_at', 'updated_at', 'name']);
  const query = buildOrganizationQuery(params, type);
  addCursorCondition(query.where, pagination);

  const { rows, count } = await Organization.findAndCountAll({
    where: query.where,
    paranoid: query.paranoid,
    limit: pagination.limit + 1,
    order: pagination.order,
  });

  const hasMore = rows.length > pagination.limit;
  const sliced = hasMore ? rows.slice(0, pagination.limit) : rows;
  const data = sliced.map((row) => {
    const json = row.toJSON();
    return {
      entity_type: type === 'agency' ? 'agency' : 'company',
      id: json.id,
      name: json.name,
      headline: json.headline,
      description: json.description,
      location: json.location,
      website: json.website,
      size: json.size,
      industry: json.industry,
      tags: json.tags,
      analytics_snapshot: json.analytics_snapshot,
      created_at: json.created_at,
      updated_at: json.updated_at,
    };
  });
  const cursorSource = hasMore ? sliced[sliced.length - 1] : null;
  const nextCursor = cursorSource ? encodeCursor(cursorSource.get(pagination.sortField)) : null;

  return {
    data,
    total: typeof count === 'number' ? count : Array.isArray(count) ? count.length : 0,
    page: {
      next_cursor: nextCursor,
      limit: pagination.limit,
    },
  };
};

const countOrganizations = async (params, type) => {
  const query = buildOrganizationQuery(params, type);
  return Organization.count({ where: query.where, paranoid: query.paranoid });
};

const buildProjectQuery = (params) => {
  const where = {};
  applySearchTerm(where, ['Project.title', 'Project.summary', 'Project.description'], params.q);
  if (params.location) {
    applyTextListFilter(where, 'Project.location', [params.location.toLowerCase()]);
  }
  if (params.tags.length) {
    applyTextListFilter(where, 'Project.tags', params.tags);
  }
  if (params.skills.length) {
    applyTextListFilter(where, 'Project.skills', params.skills);
  }

  const include = [];
  if (params.expand.has('organization')) {
    include.push({
      model: Organization,
      as: 'organization',
      attributes: ['id', 'name', 'type', 'website', 'location'],
      required: false,
    });
  }
  if (params.expand.has('client')) {
    include.push({
      model: User,
      as: 'client',
      attributes: ['id', 'email', 'role', 'active_role'],
      required: false,
    });
  }

  return { where, include, paranoid: !params.includeDeleted };
};

const searchProjects = async (params) => {
  const pagination = buildPagination(params, ['created_at', 'updated_at', 'title', 'published_at']);
  const query = buildProjectQuery(params);
  addCursorCondition(query.where, pagination);

  const { rows, count } = await Project.findAndCountAll({
    where: query.where,
    include: query.include,
    paranoid: query.paranoid,
    limit: pagination.limit + 1,
    order: pagination.order,
  });

  const hasMore = rows.length > pagination.limit;
  const sliced = hasMore ? rows.slice(0, pagination.limit) : rows;
  const data = sliced.map((row) => {
    const json = row.toJSON();
    return {
      entity_type: 'project',
      id: json.id,
      title: json.title,
      summary: json.summary,
      description: json.description,
      type: json.type,
      status: json.status,
      budget_min: json.budget_min,
      budget_max: json.budget_max,
      currency: json.currency,
      location: json.location,
      skills: extractListColumn(json.skills),
      tags: extractListColumn(json.tags),
      published_at: json.published_at,
      client_id: json.client_id,
      organization_id: json.organization_id,
      organization: json.organization,
      client: json.client,
      analytics_snapshot: json.analytics_snapshot,
      created_at: json.created_at,
      updated_at: json.updated_at,
    };
  });

  const cursorSource = hasMore ? sliced[sliced.length - 1] : null;
  const nextCursor = cursorSource ? encodeCursor(cursorSource.get(pagination.sortField)) : null;

  return {
    data,
    total: typeof count === 'number' ? count : Array.isArray(count) ? count.length : 0,
    page: {
      next_cursor: nextCursor,
      limit: pagination.limit,
    },
  };
};

const countProjects = async (params) => {
  const query = buildProjectQuery(params);
  return Project.count({ where: query.where, include: query.include, paranoid: query.paranoid });
};

const buildGigQuery = (params) => {
  const where = {};
  applySearchTerm(where, ['Gig.title', 'Gig.description'], params.q);
  if (params.location) {
    applyTextListFilter(where, 'Gig.location', [params.location.toLowerCase()]);
  }
  if (params.tags.length) {
    applyTextListFilter(where, 'Gig.tags', params.tags);
  }
  if (params.skills.length) {
    applyTextListFilter(where, 'Gig.skills', params.skills);
  }

  const include = [];
  if (params.expand.has('organization')) {
    include.push({
      model: Organization,
      as: 'organization',
      attributes: ['id', 'name', 'type', 'website', 'location'],
    });
  }
  if (params.expand.has('seller')) {
    include.push({
      model: User,
      as: 'seller',
      attributes: ['id', 'email', 'role', 'active_role'],
    });
  }

  return { where, include, paranoid: !params.includeDeleted };
};

const searchGigs = async (params) => {
  const pagination = buildPagination(params, ['created_at', 'updated_at', 'title']);
  const query = buildGigQuery(params);
  addCursorCondition(query.where, pagination);

  const { rows, count } = await Gig.findAndCountAll({
    where: query.where,
    include: query.include,
    paranoid: query.paranoid,
    limit: pagination.limit + 1,
    order: pagination.order,
  });

  const hasMore = rows.length > pagination.limit;
  const sliced = hasMore ? rows.slice(0, pagination.limit) : rows;
  const data = sliced.map((row) => {
    const json = row.toJSON();
    return {
      entity_type: 'gig',
      id: json.id,
      title: json.title,
      slug: json.slug,
      description: json.description,
      rate_amount: json.rate_amount,
      rate_unit: json.rate_unit,
      location: json.location,
      delivery_time_days: json.delivery_time_days,
      status: json.status,
      skills: extractListColumn(json.skills),
      tags: extractListColumn(json.tags),
      seller_id: json.seller_id,
      organization_id: json.organization_id,
      organization: json.organization,
      seller: json.seller,
      analytics_snapshot: json.analytics_snapshot,
      created_at: json.created_at,
      updated_at: json.updated_at,
    };
  });

  const cursorSource = hasMore ? sliced[sliced.length - 1] : null;
  const nextCursor = cursorSource ? encodeCursor(cursorSource.get(pagination.sortField)) : null;

  return {
    data,
    total: typeof count === 'number' ? count : Array.isArray(count) ? count.length : 0,
    page: {
      next_cursor: nextCursor,
      limit: pagination.limit,
    },
  };
};

const countGigs = async (params) => {
  const query = buildGigQuery(params);
  return Gig.count({ where: query.where, include: query.include, paranoid: query.paranoid });
};

const buildJobQuery = (params) => {
  const where = {};
  applySearchTerm(where, ['Job.title', 'Job.description'], params.q);
  if (params.location) {
    applyTextListFilter(where, 'Job.location', [params.location.toLowerCase()]);
  }
  if (params.tags.length) {
    applyTextListFilter(where, 'Job.tags', params.tags);
  }
  if (params.skills.length) {
    applyTextListFilter(where, 'Job.skills', params.skills);
  }

  const include = [];
  if (params.expand.has('company')) {
    include.push({
      model: Organization,
      as: 'company',
      attributes: ['id', 'name', 'type', 'website', 'location'],
    });
  }

  return { where, include, paranoid: !params.includeDeleted };
};

const searchJobs = async (params) => {
  const pagination = buildPagination(params, ['created_at', 'updated_at', 'title', 'posted_at']);
  const query = buildJobQuery(params);
  addCursorCondition(query.where, pagination);

  const { rows, count } = await Job.findAndCountAll({
    where: query.where,
    include: query.include,
    paranoid: query.paranoid,
    limit: pagination.limit + 1,
    order: pagination.order,
  });

  const hasMore = rows.length > pagination.limit;
  const sliced = hasMore ? rows.slice(0, pagination.limit) : rows;
  const data = sliced.map((row) => {
    const json = row.toJSON();
    return {
      entity_type: 'job',
      id: json.id,
      title: json.title,
      slug: json.slug,
      description: json.description,
      employment_type: json.employment_type,
      location: json.location,
      remote: json.remote,
      salary_min: json.salary_min,
      salary_max: json.salary_max,
      currency: json.currency,
      skills: extractListColumn(json.skills),
      tags: extractListColumn(json.tags),
      status: json.status,
      posted_at: json.posted_at,
      company_id: json.company_id,
      company: json.company,
      analytics_snapshot: json.analytics_snapshot,
      created_at: json.created_at,
      updated_at: json.updated_at,
    };
  });

  const cursorSource = hasMore ? sliced[sliced.length - 1] : null;
  const nextCursor = cursorSource ? encodeCursor(cursorSource.get(pagination.sortField)) : null;

  return {
    data,
    total: typeof count === 'number' ? count : Array.isArray(count) ? count.length : 0,
    page: {
      next_cursor: nextCursor,
      limit: pagination.limit,
    },
  };
};

const countJobs = async (params) => {
  const query = buildJobQuery(params);
  return Job.count({ where: query.where, include: query.include, paranoid: query.paranoid });
};

const buildGroupQuery = (params) => {
  const where = {};
  applySearchTerm(where, ['Group.name', 'Group.description'], params.q);
  if (params.location) {
    applyTextListFilter(where, 'Group.location', [params.location.toLowerCase()]);
  }
  if (params.tags.length) {
    applyTextListFilter(where, 'Group.tags', params.tags);
  }

  const include = [];
  if (params.expand.has('owner')) {
    include.push({
      model: User,
      as: 'owner',
      attributes: ['id', 'email', 'role', 'active_role'],
    });
  }

  return { where, include, paranoid: !params.includeDeleted };
};

const searchGroups = async (params) => {
  const pagination = buildPagination(params, ['created_at', 'updated_at', 'name']);
  const query = buildGroupQuery(params);
  addCursorCondition(query.where, pagination);

  const { rows, count } = await Group.findAndCountAll({
    where: query.where,
    include: query.include,
    paranoid: query.paranoid,
    limit: pagination.limit + 1,
    order: pagination.order,
  });

  const hasMore = rows.length > pagination.limit;
  const sliced = hasMore ? rows.slice(0, pagination.limit) : rows;
  const data = sliced.map((row) => {
    const json = row.toJSON();
    return {
      entity_type: 'group',
      id: json.id,
      name: json.name,
      slug: json.slug,
      description: json.description,
      privacy: json.privacy,
      location: json.location,
      tags: extractListColumn(json.tags),
      member_count: json.member_count,
      owner_id: json.owner_id,
      owner: json.owner,
      analytics_snapshot: json.analytics_snapshot,
      created_at: json.created_at,
      updated_at: json.updated_at,
    };
  });

  const cursorSource = hasMore ? sliced[sliced.length - 1] : null;
  const nextCursor = cursorSource ? encodeCursor(cursorSource.get(pagination.sortField)) : null;

  return {
    data,
    total: typeof count === 'number' ? count : Array.isArray(count) ? count.length : 0,
    page: {
      next_cursor: nextCursor,
      limit: pagination.limit,
    },
  };
};

const countGroups = async (params) => {
  const query = buildGroupQuery(params);
  return Group.count({ where: query.where, include: query.include, paranoid: query.paranoid });
};

const searchHandlers = {
  people: (params) => searchPeople(params, 'person'),
  freelancers: (params) => searchPeople(params, 'freelancer'),
  agencies: (params) => searchOrganizations(params, 'agency'),
  companies: (params) => searchOrganizations(params, 'company'),
  projects: (params) => searchProjects(params),
  gigs: (params) => searchGigs(params),
  jobs: (params) => searchJobs(params),
  groups: (params) => searchGroups(params),
};

const countHandlers = {
  people: (params) => countPeople(params, 'person'),
  freelancers: (params) => countPeople(params, 'freelancer'),
  agencies: (params) => countOrganizations(params, 'agency'),
  companies: (params) => countOrganizations(params, 'company'),
  projects: (params) => countProjects(params),
  gigs: (params) => countGigs(params),
  jobs: (params) => countJobs(params),
  groups: (params) => countGroups(params),
};

const computeAnalytics = async (params) => {
  const counts = await Promise.all(
    SUPPORTED_TYPES.map(async (type) => [type, await countHandlers[type](params)])
  );
  return {
    counts: Object.fromEntries(counts),
  };
};

const filterFields = (data, fields) => {
  if (!fields.length) return data;
  const fieldSet = new Set([...fields, 'id', 'entity_type']);
  return data.map((item) => {
    const filtered = {};
    fieldSet.forEach((field) => {
      if (item[field] !== undefined) {
        filtered[field] = item[field];
      }
    });
    return filtered;
  });
};

const search = async (query, currentUser) => {
  if (query.type && !SUPPORTED_TYPES.includes(query.type)) {
    throw new ApiError(400, `Unsupported search type: ${query.type}`, 'INVALID_SEARCH_TYPE');
  }

  const params = normalizeParams(query, currentUser);
  const handler = searchHandlers[params.type];
  if (!handler) {
    throw new ApiError(400, `Unsupported search type: ${params.type}`, 'INVALID_SEARCH_TYPE');
  }

  const result = await handler(params);
  if (params.analytics) {
    result.analytics = await computeAnalytics(params);
  }
  result.data = filterFields(result.data, params.fields);
  return result;
};

const suggestionHandlers = {
  async skills(params) {
    const where = {};
    if (params.q) {
      const term = `%${params.q.toLowerCase()}%`;
      where[Op.and] = [sequelize.where(fn('lower', col('Skill.name')), { [Op.like]: term })];
    }
    const rows = await Skill.findAll({
      where,
      order: [['name', 'ASC']],
      limit: params.limit,
    });
    return rows.map((row) => ({ id: row.id, value: row.name, type: 'skill' }));
  },
  async tags(params) {
    const where = {};
    if (params.q) {
      const term = `%${params.q.toLowerCase()}%`;
      where[Op.and] = [sequelize.where(fn('lower', col('Tag.name')), { [Op.like]: term })];
    }
    const rows = await Tag.findAll({
      where,
      order: [['name', 'ASC']],
      limit: params.limit,
    });
    return rows.map((row) => ({ id: row.id, value: row.name, type: 'tag' }));
  },
  async titles(params) {
    const limit = params.limit;
    const whereBuilder = (modelAlias) => {
      if (!params.q) return undefined;
      const term = `%${params.q.toLowerCase()}%`;
      return {
        [Op.and]: [sequelize.where(fn('lower', col(`${modelAlias}.title`)), { [Op.like]: term })],
      };
    };
    const [projectRows, gigRows, jobRows] = await Promise.all([
      Project.findAll({ where: whereBuilder('Project'), attributes: ['id', 'title'], limit, order: [['updated_at', 'DESC']] }),
      Gig.findAll({ where: whereBuilder('Gig'), attributes: ['id', 'title'], limit, order: [['updated_at', 'DESC']] }),
      Job.findAll({ where: whereBuilder('Job'), attributes: ['id', 'title'], limit, order: [['updated_at', 'DESC']] }),
    ]);

    const combined = [
      ...projectRows.map((row) => ({ id: row.id, value: row.title, source: 'project' })),
      ...gigRows.map((row) => ({ id: row.id, value: row.title, source: 'gig' })),
      ...jobRows.map((row) => ({ id: row.id, value: row.title, source: 'job' })),
    ];
    const unique = [];
    const seen = new Set();
    for (const entry of combined) {
      const key = entry.value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push({ ...entry, type: 'title' });
      if (unique.length >= limit) break;
    }
    return unique.slice(0, limit);
  },
  async companies(params) {
    const where = { type: 'company' };
    if (params.q) {
      const term = `%${params.q.toLowerCase()}%`;
      where[Op.and] = [sequelize.where(fn('lower', col('Organization.name')), { [Op.like]: term })];
    }
    const rows = await Organization.findAll({
      where,
      order: [['name', 'ASC']],
      limit: params.limit,
    });
    return rows.map((row) => ({ id: row.id, value: row.name, type: 'company' }));
  },
};

const getSuggestions = async (query) => {
  const type = query.type;
  const limit = Math.min(query.limit || 10, 50);
  const handler = suggestionHandlers[type];
  if (!handler) {
    throw new ApiError(400, `Unsupported suggestion type: ${type}`, 'INVALID_SUGGESTION_TYPE');
  }
  const data = await handler({ ...query, limit });
  return { data };
};

module.exports = {
  search,
  getSuggestions,
};
