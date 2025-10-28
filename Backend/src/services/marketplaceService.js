'use strict';

const { Op, fn, col } = require('sequelize');
const {
  sequelize,
  Organization,
  Project,
  Gig,
  Job,
  Group,
  User,
} = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { buildPagination, encodeCursor } = require('../utils/pagination');
const { parseArrayParam, toLowerList } = require('../utils/requestParsers');

const ensureAuthenticated = (user) => {
  if (!user) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }
};

const ensureRole = (user, roles) => {
  ensureAuthenticated(user);
  if (!roles.includes(user.role)) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }
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

const filterFields = (data, fields, alwaysInclude = ['id']) => {
  if (!fields.length) return Array.isArray(data) ? data : { ...data };
  const fieldSet = new Set([...fields, ...alwaysInclude]);
  const filterOne = (item) => {
    const filtered = {};
    fieldSet.forEach((field) => {
      if (item[field] !== undefined) {
        filtered[field] = item[field];
      }
    });
    return filtered;
  };
  if (Array.isArray(data)) {
    return data.map(filterOne);
  }
  return filterOne(data);
};

const toSet = (values) => new Set(parseArrayParam(values).map((value) => value.toLowerCase()));

const baseViewOptions = (query, currentUser) => {
  const expand = toSet(query.expand);
  const include = toSet(query.include);
  return {
    expand,
    include,
    fields: parseArrayParam(query.fields),
    includeDeleted: include.has('deleted') && currentUser?.role === 'admin',
  };
};

const listParams = (query, currentUser) => ({
  ...baseViewOptions(query, currentUser),
  q: query.q ? String(query.q).trim() : undefined,
  cursor: query.cursor,
  limit: query.limit,
  sort: query.sort,
  analytics: query.analytics,
});

const formatOrganization = (row) => {
  const json = row.toJSON();
  return {
    id: json.id,
    type: json.type,
    name: json.name,
    headline: json.headline,
    description: json.description,
    location: json.location,
    website: json.website,
    size: json.size,
    industry: json.industry,
    tags: json.tags || [],
    metadata: json.metadata,
    analytics_snapshot: json.analytics_snapshot,
    created_at: json.created_at,
    updated_at: json.updated_at,
    deleted_at: json.deleted_at,
    projects: json.projects,
    gigs: json.gigs,
    jobs: json.jobs,
  };
};

const organizationIncludes = (expand) => {
  const include = [];
  if (expand.has('projects')) {
    include.push({
      model: Project,
      as: 'projects',
      attributes: ['id', 'title', 'status', 'type', 'published_at'],
    });
  }
  if (expand.has('gigs')) {
    include.push({
      model: Gig,
      as: 'gigs',
      attributes: ['id', 'title', 'status', 'rate_unit'],
    });
  }
  if (expand.has('jobs')) {
    include.push({
      model: Job,
      as: 'jobs',
      attributes: ['id', 'title', 'status', 'employment_type'],
    });
  }
  return include;
};

const buildOrganizationQuery = (params) => {
  const where = {};
  if (params.type) {
    where.type = params.type;
  }
  if (params.industry) {
    applyTextListFilter(where, 'Organization.industry', [params.industry.toLowerCase()]);
  }
  if (params.size) {
    applyTextListFilter(where, 'Organization.size', [params.size.toLowerCase()]);
  }
  if (params.location) {
    applyTextListFilter(where, 'Organization.location', [params.location.toLowerCase()]);
  }
  if (params.tags?.length) {
    applyTextListFilter(where, 'Organization.tags', params.tags);
  }
  applySearchTerm(where, ['Organization.name', 'Organization.headline', 'Organization.description'], params.q);

  return {
    where,
    include: organizationIncludes(params.expand),
    paranoid: !params.includeDeleted,
  };
};

const executeList = async (Model, query, pagination, { format, attributes, distinct = true }) => {
  addCursorCondition(query.where, pagination);
  const { rows, count } = await Model.findAndCountAll({
    where: query.where,
    include: query.include,
    paranoid: query.paranoid,
    limit: pagination.limit + 1,
    order: pagination.order,
    distinct,
    attributes,
  });

  const hasMore = rows.length > pagination.limit;
  const sliced = hasMore ? rows.slice(0, pagination.limit) : rows;
  const cursorSource = hasMore ? sliced[sliced.length - 1] : null;
  const nextCursorValue = cursorSource ? cursorSource.get(pagination.sortField) : null;
  const data = format ? sliced.map(format) : sliced.map((row) => row.toJSON());
  return {
    data,
    total: typeof count === 'number' ? count : Array.isArray(count) ? count.length : 0,
    page: {
      limit: pagination.limit,
      next_cursor: nextCursorValue !== null && nextCursorValue !== undefined ? encodeCursor(nextCursorValue) : null,
    },
  };
};

const organizationAnalytics = async (params) => {
  const query = buildOrganizationQuery(params);
  const total = await Organization.count({ where: query.where, paranoid: query.paranoid });
  const byTypeRows = await Organization.findAll({
    where: query.where,
    paranoid: query.paranoid,
    attributes: ['type', [fn('COUNT', col('Organization.id')), 'count']],
    group: ['type'],
    raw: true,
  });
  const byType = Object.fromEntries(byTypeRows.map((row) => [row.type, Number(row.count)]));
  return { total, by_type: byType };
};

const listOrganizations = async (query, currentUser) => {
  const params = {
    ...listParams(query, currentUser),
    type: query.type,
    industry: query.industry,
    size: query.size,
    location: query.location,
    tags: toLowerList(query.tags),
  };

  const pagination = buildPagination(params, ['created_at', 'updated_at', 'name']);
  const builtQuery = buildOrganizationQuery(params);
  const result = await executeList(Organization, builtQuery, pagination, { format: formatOrganization });
  const filtered = filterFields(result.data, params.fields);
  const payload = { ...result, data: filtered };
  if (query.analytics && currentUser?.role === 'admin') {
    payload.analytics = await organizationAnalytics(params);
  }
  return payload;
};

const getOrganization = async (id, options, currentUser) => {
  const params = { ...baseViewOptions(options, currentUser) };
  const organization = await Organization.findByPk(id, {
    include: organizationIncludes(params.expand),
    paranoid: !params.includeDeleted,
  });
  if (!organization) {
    throw new ApiError(404, 'Organization not found', 'ORGANIZATION_NOT_FOUND');
  }
  return filterFields(formatOrganization(organization), params.fields);
};

const createOrganization = async (body, currentUser, options) => {
  ensureRole(currentUser, ['admin']);
  const organization = await Organization.create({
    type: body.type,
    name: body.name,
    headline: body.headline,
    description: body.description,
    location: body.location,
    website: body.website,
    size: body.size,
    industry: body.industry,
    tags: body.tags,
    metadata: body.metadata,
    analytics_snapshot: body.analytics_snapshot,
  });
  return getOrganization(organization.id, options, currentUser);
};

const updateOrganization = async (id, body, currentUser, options) => {
  ensureRole(currentUser, ['admin']);
  const organization = await Organization.findByPk(id);
  if (!organization) {
    throw new ApiError(404, 'Organization not found', 'ORGANIZATION_NOT_FOUND');
  }
  await organization.update({
    type: body.type ?? organization.type,
    name: body.name ?? organization.name,
    headline: body.headline ?? organization.headline,
    description: body.description ?? organization.description,
    location: body.location ?? organization.location,
    website: body.website ?? organization.website,
    size: body.size ?? organization.size,
    industry: body.industry ?? organization.industry,
    tags: body.tags ?? organization.tags,
    metadata: body.metadata ?? organization.metadata,
    analytics_snapshot: body.analytics_snapshot ?? organization.analytics_snapshot,
  });
  return getOrganization(id, options, currentUser);
};

const deleteOrganization = async (id, currentUser) => {
  ensureRole(currentUser, ['admin']);
  const deleted = await Organization.destroy({ where: { id } });
  if (!deleted) {
    throw new ApiError(404, 'Organization not found', 'ORGANIZATION_NOT_FOUND');
  }
  return { success: true };
};

const formatProject = (row) => {
  const json = row.toJSON();
  return {
    id: json.id,
    client_id: json.client_id,
    organization_id: json.organization_id,
    title: json.title,
    summary: json.summary,
    description: json.description,
    type: json.type,
    status: json.status,
    budget_min: json.budget_min,
    budget_max: json.budget_max,
    currency: json.currency,
    location: json.location,
    skills: json.skills || [],
    tags: json.tags || [],
    published_at: json.published_at,
    analytics_snapshot: json.analytics_snapshot,
    created_at: json.created_at,
    updated_at: json.updated_at,
    deleted_at: json.deleted_at,
    organization: json.organization,
    client: json.client,
  };
};

const projectIncludes = (expand) => {
  const include = [];
  if (expand.has('organization')) {
    include.push({
      model: Organization,
      as: 'organization',
      attributes: ['id', 'name', 'type', 'website', 'location'],
    });
  }
  if (expand.has('client')) {
    include.push({
      model: User,
      as: 'client',
      attributes: ['id', 'email', 'role', 'active_role'],
    });
  }
  return include;
};

const buildProjectQuery = (params) => {
  const where = {};
  if (params.status) {
    where.status = params.status;
  }
  if (params.typeFilter) {
    where.type = params.typeFilter;
  }
  if (params.client_id) {
    where.client_id = params.client_id;
  }
  if (params.organization_id) {
    where.organization_id = params.organization_id;
  }
  if (params.location) {
    applyTextListFilter(where, 'Project.location', [params.location.toLowerCase()]);
  }
  if (params.tags?.length) {
    applyTextListFilter(where, 'Project.tags', params.tags);
  }
  if (params.skills?.length) {
    applyTextListFilter(where, 'Project.skills', params.skills);
  }
  applySearchTerm(where, ['Project.title', 'Project.summary', 'Project.description'], params.q);

  return {
    where,
    include: projectIncludes(params.expand),
    paranoid: !params.includeDeleted,
  };
};

const projectAnalytics = async (params) => {
  const query = buildProjectQuery(params);
  const total = await Project.count({ where: query.where, paranoid: query.paranoid });
  const byStatusRows = await Project.findAll({
    where: query.where,
    paranoid: query.paranoid,
    attributes: ['status', [fn('COUNT', col('Project.id')), 'count']],
    group: ['status'],
    raw: true,
  });
  const byTypeRows = await Project.findAll({
    where: query.where,
    paranoid: query.paranoid,
    attributes: ['type', [fn('COUNT', col('Project.id')), 'count']],
    group: ['type'],
    raw: true,
  });
  return {
    total,
    by_status: Object.fromEntries(byStatusRows.map((row) => [row.status, Number(row.count)])),
    by_type: Object.fromEntries(byTypeRows.map((row) => [row.type, Number(row.count)])),
  };
};

const listProjects = async (query, currentUser) => {
  const params = {
    ...listParams(query, currentUser),
    status: query.status,
    typeFilter: query.type,
    client_id: query.client_id,
    organization_id: query.organization_id,
    location: query.location,
    tags: toLowerList(query.tags),
    skills: toLowerList(query.skills),
  };
  const pagination = buildPagination(params, ['created_at', 'updated_at', 'title', 'published_at']);
  const builtQuery = buildProjectQuery(params);
  const result = await executeList(Project, builtQuery, pagination, { format: formatProject });
  const filtered = filterFields(result.data, params.fields);
  const payload = { ...result, data: filtered };
  if (query.analytics) {
    payload.analytics = await projectAnalytics(params);
  }
  return payload;
};

const getProject = async (id, options, currentUser) => {
  const params = { ...baseViewOptions(options, currentUser) };
  const project = await Project.findByPk(id, {
    include: projectIncludes(params.expand),
    paranoid: !params.includeDeleted,
  });
  if (!project) {
    throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }
  return filterFields(formatProject(project), params.fields);
};

const assertProjectPermission = async (project, currentUser) => {
  if (currentUser.role === 'admin') {
    return;
  }
  if (currentUser.role === 'client' && project.client_id === currentUser.id) {
    return;
  }
  throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
};

const createProject = async (body, currentUser, options) => {
  ensureRole(currentUser, ['admin', 'client']);
  const payload = { ...body };
  if (!payload.client_id && currentUser.role === 'client') {
    payload.client_id = currentUser.id;
  }
  const project = await Project.create(payload);
  return getProject(project.id, options, currentUser);
};

const updateProject = async (id, body, currentUser, options) => {
  ensureRole(currentUser, ['admin', 'client']);
  const project = await Project.findByPk(id);
  if (!project) {
    throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }
  await assertProjectPermission(project, currentUser);
  await project.update(body);
  return getProject(id, options, currentUser);
};

const deleteProject = async (id, currentUser) => {
  ensureRole(currentUser, ['admin', 'client']);
  const project = await Project.findByPk(id);
  if (!project) {
    throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }
  await assertProjectPermission(project, currentUser);
  await project.destroy();
  return { success: true };
};

const formatGig = (row) => {
  const json = row.toJSON();
  return {
    id: json.id,
    seller_id: json.seller_id,
    organization_id: json.organization_id,
    title: json.title,
    slug: json.slug,
    description: json.description,
    rate_amount: json.rate_amount,
    rate_unit: json.rate_unit,
    location: json.location,
    delivery_time_days: json.delivery_time_days,
    status: json.status,
    skills: json.skills || [],
    tags: json.tags || [],
    analytics_snapshot: json.analytics_snapshot,
    created_at: json.created_at,
    updated_at: json.updated_at,
    deleted_at: json.deleted_at,
    organization: json.organization,
    seller: json.seller,
  };
};

const gigIncludes = (expand) => {
  const include = [];
  if (expand.has('organization')) {
    include.push({
      model: Organization,
      as: 'organization',
      attributes: ['id', 'name', 'type', 'website', 'location'],
    });
  }
  if (expand.has('seller')) {
    include.push({
      model: User,
      as: 'seller',
      attributes: ['id', 'email', 'role', 'active_role'],
    });
  }
  return include;
};

const buildGigQuery = (params) => {
  const where = {};
  if (params.status) {
    where.status = params.status;
  }
  if (params.rate_unit) {
    where.rate_unit = params.rate_unit;
  }
  if (params.seller_id) {
    where.seller_id = params.seller_id;
  }
  if (params.organization_id) {
    where.organization_id = params.organization_id;
  }
  if (params.location) {
    applyTextListFilter(where, 'Gig.location', [params.location.toLowerCase()]);
  }
  if (params.tags?.length) {
    applyTextListFilter(where, 'Gig.tags', params.tags);
  }
  if (params.skills?.length) {
    applyTextListFilter(where, 'Gig.skills', params.skills);
  }
  applySearchTerm(where, ['Gig.title', 'Gig.description'], params.q);

  return {
    where,
    include: gigIncludes(params.expand),
    paranoid: !params.includeDeleted,
  };
};

const gigAnalytics = async (params) => {
  const query = buildGigQuery(params);
  const total = await Gig.count({ where: query.where, paranoid: query.paranoid });
  const byStatusRows = await Gig.findAll({
    where: query.where,
    paranoid: query.paranoid,
    attributes: ['status', [fn('COUNT', col('Gig.id')), 'count']],
    group: ['status'],
    raw: true,
  });
  const byRateUnitRows = await Gig.findAll({
    where: query.where,
    paranoid: query.paranoid,
    attributes: ['rate_unit', [fn('COUNT', col('Gig.id')), 'count']],
    group: ['rate_unit'],
    raw: true,
  });
  return {
    total,
    by_status: Object.fromEntries(byStatusRows.map((row) => [row.status, Number(row.count)])),
    by_rate_unit: Object.fromEntries(byRateUnitRows.map((row) => [row.rate_unit, Number(row.count)])),
  };
};

const listGigs = async (query, currentUser) => {
  const params = {
    ...listParams(query, currentUser),
    status: query.status,
    rate_unit: query.rate_unit,
    seller_id: query.seller_id,
    organization_id: query.organization_id,
    location: query.location,
    tags: toLowerList(query.tags),
    skills: toLowerList(query.skills),
  };
  const pagination = buildPagination(params, ['created_at', 'updated_at', 'title']);
  const builtQuery = buildGigQuery(params);
  const result = await executeList(Gig, builtQuery, pagination, { format: formatGig });
  const filtered = filterFields(result.data, params.fields);
  const payload = { ...result, data: filtered };
  if (query.analytics) {
    payload.analytics = await gigAnalytics(params);
  }
  return payload;
};

const getGig = async (id, options, currentUser) => {
  const params = { ...baseViewOptions(options, currentUser) };
  const gig = await Gig.findByPk(id, {
    include: gigIncludes(params.expand),
    paranoid: !params.includeDeleted,
  });
  if (!gig) {
    throw new ApiError(404, 'Gig not found', 'GIG_NOT_FOUND');
  }
  return filterFields(formatGig(gig), params.fields);
};

const assertGigPermission = async (gig, currentUser) => {
  if (currentUser.role === 'admin') {
    return;
  }
  if (currentUser.role === 'freelancer' && gig.seller_id === currentUser.id) {
    return;
  }
  throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
};

const createGig = async (body, currentUser, options) => {
  ensureRole(currentUser, ['admin', 'freelancer']);
  const payload = { ...body };
  if (currentUser.role === 'freelancer') {
    payload.seller_id = currentUser.id;
  }
  if (!payload.seller_id) {
    payload.seller_id = currentUser.id;
  }
  const gig = await Gig.create(payload);
  return getGig(gig.id, options, currentUser);
};

const updateGig = async (id, body, currentUser, options) => {
  ensureRole(currentUser, ['admin', 'freelancer']);
  const gig = await Gig.findByPk(id);
  if (!gig) {
    throw new ApiError(404, 'Gig not found', 'GIG_NOT_FOUND');
  }
  await assertGigPermission(gig, currentUser);
  await gig.update(body);
  return getGig(id, options, currentUser);
};

const deleteGig = async (id, currentUser) => {
  ensureRole(currentUser, ['admin', 'freelancer']);
  const gig = await Gig.findByPk(id);
  if (!gig) {
    throw new ApiError(404, 'Gig not found', 'GIG_NOT_FOUND');
  }
  await assertGigPermission(gig, currentUser);
  await gig.destroy();
  return { success: true };
};

const formatJob = (row) => {
  const json = row.toJSON();
  return {
    id: json.id,
    company_id: json.company_id,
    title: json.title,
    slug: json.slug,
    description: json.description,
    employment_type: json.employment_type,
    location: json.location,
    remote: json.remote,
    salary_min: json.salary_min,
    salary_max: json.salary_max,
    currency: json.currency,
    skills: json.skills || [],
    tags: json.tags || [],
    status: json.status,
    posted_at: json.posted_at,
    analytics_snapshot: json.analytics_snapshot,
    created_at: json.created_at,
    updated_at: json.updated_at,
    deleted_at: json.deleted_at,
    company: json.company,
  };
};

const jobIncludes = (expand) => {
  const include = [];
  if (expand.has('company')) {
    include.push({
      model: Organization,
      as: 'company',
      attributes: ['id', 'name', 'type', 'website', 'location'],
    });
  }
  return include;
};

const buildJobQuery = (params) => {
  const where = {};
  if (params.status) {
    where.status = params.status;
  }
  if (params.employment_type) {
    where.employment_type = params.employment_type;
  }
  if (params.company_id) {
    where.company_id = params.company_id;
  }
  if (params.remote !== undefined) {
    where.remote = params.remote;
  }
  if (params.location) {
    applyTextListFilter(where, 'Job.location', [params.location.toLowerCase()]);
  }
  if (params.tags?.length) {
    applyTextListFilter(where, 'Job.tags', params.tags);
  }
  if (params.skills?.length) {
    applyTextListFilter(where, 'Job.skills', params.skills);
  }
  applySearchTerm(where, ['Job.title', 'Job.description'], params.q);

  return {
    where,
    include: jobIncludes(params.expand),
    paranoid: !params.includeDeleted,
  };
};

const jobAnalytics = async (params) => {
  const query = buildJobQuery(params);
  const total = await Job.count({ where: query.where, paranoid: query.paranoid });
  const byStatusRows = await Job.findAll({
    where: query.where,
    paranoid: query.paranoid,
    attributes: ['status', [fn('COUNT', col('Job.id')), 'count']],
    group: ['status'],
    raw: true,
  });
  const byEmploymentRows = await Job.findAll({
    where: query.where,
    paranoid: query.paranoid,
    attributes: ['employment_type', [fn('COUNT', col('Job.id')), 'count']],
    group: ['employment_type'],
    raw: true,
  });
  return {
    total,
    by_status: Object.fromEntries(byStatusRows.map((row) => [row.status, Number(row.count)])),
    by_employment_type: Object.fromEntries(
      byEmploymentRows.map((row) => [row.employment_type, Number(row.count)])
    ),
  };
};

const listJobs = async (query, currentUser) => {
  const params = {
    ...listParams(query, currentUser),
    status: query.status,
    employment_type: query.employment_type,
    company_id: query.company_id,
    remote: query.remote !== undefined ? query.remote === true || String(query.remote).toLowerCase() === 'true' : undefined,
    location: query.location,
    tags: toLowerList(query.tags),
    skills: toLowerList(query.skills),
  };
  const pagination = buildPagination(params, ['created_at', 'updated_at', 'title', 'posted_at']);
  const builtQuery = buildJobQuery(params);
  const result = await executeList(Job, builtQuery, pagination, { format: formatJob });
  const filtered = filterFields(result.data, params.fields);
  const payload = { ...result, data: filtered };
  if (query.analytics) {
    payload.analytics = await jobAnalytics(params);
  }
  return payload;
};

const getJob = async (id, options, currentUser) => {
  const params = { ...baseViewOptions(options, currentUser) };
  const job = await Job.findByPk(id, {
    include: jobIncludes(params.expand),
    paranoid: !params.includeDeleted,
  });
  if (!job) {
    throw new ApiError(404, 'Job not found', 'JOB_NOT_FOUND');
  }
  return filterFields(formatJob(job), params.fields);
};

const assertJobPermission = async (job, currentUser) => {
  if (currentUser.role === 'admin') {
    return;
  }
  if (currentUser.role === 'client' && job.company_id && currentUser.org_id === job.company_id) {
    return;
  }
  throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
};

const createJob = async (body, currentUser, options) => {
  ensureRole(currentUser, ['admin', 'client']);
  const payload = { ...body };
  if (!payload.company_id && currentUser.role === 'client') {
    payload.company_id = currentUser.org_id;
  }
  if (!payload.company_id) {
    throw new ApiError(400, 'company_id is required', 'COMPANY_REQUIRED');
  }
  const job = await Job.create(payload);
  return getJob(job.id, options, currentUser);
};

const updateJob = async (id, body, currentUser, options) => {
  ensureRole(currentUser, ['admin', 'client']);
  const job = await Job.findByPk(id);
  if (!job) {
    throw new ApiError(404, 'Job not found', 'JOB_NOT_FOUND');
  }
  await assertJobPermission(job, currentUser);
  await job.update(body);
  return getJob(id, options, currentUser);
};

const deleteJob = async (id, currentUser) => {
  ensureRole(currentUser, ['admin', 'client']);
  const job = await Job.findByPk(id);
  if (!job) {
    throw new ApiError(404, 'Job not found', 'JOB_NOT_FOUND');
  }
  await assertJobPermission(job, currentUser);
  await job.destroy();
  return { success: true };
};

const formatGroup = (row) => {
  const json = row.toJSON();
  return {
    id: json.id,
    owner_id: json.owner_id,
    name: json.name,
    slug: json.slug,
    description: json.description,
    privacy: json.privacy,
    location: json.location,
    tags: json.tags || [],
    member_count: json.member_count,
    analytics_snapshot: json.analytics_snapshot,
    created_at: json.created_at,
    updated_at: json.updated_at,
    deleted_at: json.deleted_at,
    owner: json.owner,
  };
};

const groupIncludes = (expand) => {
  const include = [];
  if (expand.has('owner')) {
    include.push({
      model: User,
      as: 'owner',
      attributes: ['id', 'email', 'role', 'active_role'],
    });
  }
  return include;
};

const buildGroupQuery = (params) => {
  const where = {};
  if (params.privacy) {
    where.privacy = params.privacy;
  }
  if (params.owner_id) {
    where.owner_id = params.owner_id;
  }
  if (params.location) {
    applyTextListFilter(where, 'Group.location', [params.location.toLowerCase()]);
  }
  if (params.tags?.length) {
    applyTextListFilter(where, 'Group.tags', params.tags);
  }
  applySearchTerm(where, ['Group.name', 'Group.description'], params.q);

  return {
    where,
    include: groupIncludes(params.expand),
    paranoid: !params.includeDeleted,
  };
};

const groupAnalytics = async (params) => {
  const query = buildGroupQuery(params);
  const total = await Group.count({ where: query.where, paranoid: query.paranoid });
  const byPrivacyRows = await Group.findAll({
    where: query.where,
    paranoid: query.paranoid,
    attributes: ['privacy', [fn('COUNT', col('Group.id')), 'count']],
    group: ['privacy'],
    raw: true,
  });
  return {
    total,
    by_privacy: Object.fromEntries(byPrivacyRows.map((row) => [row.privacy, Number(row.count)])),
  };
};

const listGroups = async (query, currentUser) => {
  const params = {
    ...listParams(query, currentUser),
    privacy: query.privacy,
    owner_id: query.owner_id,
    location: query.location,
    tags: toLowerList(query.tags),
  };
  const pagination = buildPagination(params, ['created_at', 'updated_at', 'name']);
  const builtQuery = buildGroupQuery(params);
  const result = await executeList(Group, builtQuery, pagination, { format: formatGroup });
  const filtered = filterFields(result.data, params.fields);
  const payload = { ...result, data: filtered };
  if (query.analytics) {
    payload.analytics = await groupAnalytics(params);
  }
  return payload;
};

const getGroup = async (id, options, currentUser) => {
  const params = { ...baseViewOptions(options, currentUser) };
  const group = await Group.findByPk(id, {
    include: groupIncludes(params.expand),
    paranoid: !params.includeDeleted,
  });
  if (!group) {
    throw new ApiError(404, 'Group not found', 'GROUP_NOT_FOUND');
  }
  return filterFields(formatGroup(group), params.fields);
};

const assertGroupPermission = async (group, currentUser) => {
  if (currentUser.role === 'admin') {
    return;
  }
  if (group.owner_id === currentUser.id) {
    return;
  }
  throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
};

const createGroup = async (body, currentUser, options) => {
  ensureAuthenticated(currentUser);
  const payload = { ...body, owner_id: currentUser.id };
  const group = await Group.create(payload);
  return getGroup(group.id, options, currentUser);
};

const updateGroup = async (id, body, currentUser, options) => {
  ensureAuthenticated(currentUser);
  const group = await Group.findByPk(id);
  if (!group) {
    throw new ApiError(404, 'Group not found', 'GROUP_NOT_FOUND');
  }
  await assertGroupPermission(group, currentUser);
  await group.update(body);
  return getGroup(id, options, currentUser);
};

const deleteGroup = async (id, currentUser) => {
  ensureAuthenticated(currentUser);
  const group = await Group.findByPk(id);
  if (!group) {
    throw new ApiError(404, 'Group not found', 'GROUP_NOT_FOUND');
  }
  await assertGroupPermission(group, currentUser);
  await group.destroy();
  return { success: true };
};

module.exports = {
  // Organizations
  listOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  organizationAnalytics,
  // Projects
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  projectAnalytics,
  // Gigs
  listGigs,
  getGig,
  createGig,
  updateGig,
  deleteGig,
  gigAnalytics,
  // Jobs
  listJobs,
  getJob,
  createJob,
  updateJob,
  deleteJob,
  jobAnalytics,
  // Groups
  listGroups,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  groupAnalytics,
};
