const dayjs = require('dayjs');
const { Op, fn, col, where, literal } = require('sequelize');
const {
  Job,
  JobTag,
  JobStage,
  JobMetric,
  User,
  sequelize,
} = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { buildPagination, encodeCursor } = require('../utils/pagination');

const ALLOWED_CREATOR_ROLES = new Set(['client', 'admin']);
const DEFAULT_PIPELINE = [
  { name: 'Application Review' },
  { name: 'Initial Screen' },
  { name: 'Interview' },
  { name: 'Offer' },
  { name: 'Hired' },
];
const ALLOWED_SORT_FIELDS = ['created_at', 'published_at', 'views_count', 'applications_count'];
const PUBLIC_STATUSES = new Set(['open', 'paused', 'closed']);

const normalizeTags = (tags = []) =>
  [...new Set(tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))];

const formatJob = (job) => {
  if (!job) return job;
  const plain = job.toJSON();
  if (plain.tagAssignments) {
    plain.tags = plain.tagAssignments.map((tag) => tag.tag);
    delete plain.tagAssignments;
  }
  if (plain.stages) {
    plain.stages = plain.stages
      .slice()
      .sort((a, b) => a.order_index - b.order_index)
      .map((stage) => ({ ...stage, order_index: Number(stage.order_index) }));
  }
  return plain;
};

const ensureJobAccess = (job, user, { allowPublic = false } = {}) => {
  if (!job) {
    throw new ApiError(404, 'Job not found', 'JOB_NOT_FOUND');
  }
  if (allowPublic && PUBLIC_STATUSES.has(job.status)) {
    return;
  }
  if (!user) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }
  if (user.role === 'admin') {
    return;
  }
  if (job.posted_by !== user.id && job.company_id !== user.id && user.org_id !== job.company_id) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }
};

const ensureCanCreateJob = (user) => {
  if (!user) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }
  if (!ALLOWED_CREATOR_ROLES.has(user.role) && user.role !== 'admin') {
    throw new ApiError(403, 'Only company or agency accounts can publish jobs', 'FORBIDDEN');
  }
};

const findJobById = async (id, { includeDeleted = false, include = [] } = {}) => {
  const job = await Job.findByPk(id, {
    include,
    paranoid: !includeDeleted,
  });
  return job;
};

const applyTagChanges = async (jobId, tags, transaction) => {
  const normalized = normalizeTags(tags);
  await JobTag.destroy({ where: { job_id: jobId }, transaction });
  if (normalized.length) {
    await JobTag.bulkCreate(
      normalized.map((tag) => ({ job_id: jobId, tag })),
      { transaction }
    );
  }
};

const createPipeline = async (jobId, stages = [], transaction) => {
  const base = stages.length ? stages : DEFAULT_PIPELINE;
  const normalized = base.map((stage, index) => ({
    job_id: jobId,
    name: stage.name,
    order_index: index + 1,
    is_default: index === 0,
    auto_advance_days: stage.auto_advance_days ?? null,
  }));
  await JobStage.bulkCreate(normalized, { transaction });
};

const incrementJobCounters = async (jobId, { views = 0, applications = 0, hires = 0 } = {}) => {
  const updates = {};
  if (views) updates.views_count = literal(`views_count + ${views}`);
  if (applications) updates.applications_count = literal(`applications_count + ${applications}`);
  if (hires) updates.hires_count = literal(`hires_count + ${hires}`);
  if (Object.keys(updates).length) {
    await Job.update(updates, { where: { id: jobId } });
  }
  if (views || applications) {
    const metricDate = dayjs().startOf('day').toDate();
    const [metric] = await JobMetric.findOrCreate({
      where: { job_id: jobId, metric_date: metricDate },
      defaults: { views_count: 0, applications_count: 0 },
    });
    if (views) metric.views_count += views;
    if (applications) metric.applications_count += applications;
    await metric.save();
  }
};

const listJobs = async (user, query) => {
  const pagination = buildPagination(query, ALLOWED_SORT_FIELDS);
  const baseWhere = {};
  const include = [];
  const filterIncludes = [];

  if (query.company_id) baseWhere.company_id = query.company_id;
  if (query.location) baseWhere.location = query.location;
  if (query.type) baseWhere.job_type = query.type;
  if (query.status) baseWhere.status = query.status;
  if (query.salary_min) {
    baseWhere.salary_max = { [Op.gte]: Number(query.salary_min) };
  }

  if (query.q) {
    const term = String(query.q).toLowerCase();
    baseWhere[Op.or] = [
      where(fn('LOWER', col('Job.title')), { [Op.like]: `%${term}%` }),
      where(fn('LOWER', col('Job.description')), { [Op.like]: `%${term}%` }),
    ];
  }

  const expansions = new Set(
    (query.expand || '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
  );

  const addInclude = (relation) => {
    if (!include.find((item) => item.as === relation.as)) {
      include.push(relation);
    }
  };

  if (query.tags) {
    const tags = normalizeTags(query.tags.split(','));
    if (tags.length) {
      const relation = {
        model: JobTag,
        as: 'tagAssignments',
        attributes: ['tag'],
        where: { tag: { [Op.in]: tags } },
        required: true,
      };
      include.push(relation);
      filterIncludes.push(relation);
    }
  } else if (expansions.has('tags')) {
    addInclude({ model: JobTag, as: 'tagAssignments', attributes: ['tag'] });
  }

  if (expansions.has('stages')) {
    addInclude({ model: JobStage, as: 'stages' });
  }

  if (expansions.has('owner')) {
    addInclude({ model: User, as: 'owner', attributes: ['id', 'email', 'role', 'org_id'] });
  }

  const attributes = (() => {
    if (!query.fields) return undefined;
    const allowed = [
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
      'created_at',
      'updated_at',
      'company_id',
      'posted_by',
    ];
    const requested = query.fields
      .split(',')
      .map((field) => field.trim())
      .filter((field) => allowed.includes(field));
    if (!requested.includes('id')) requested.push('id');
    return requested;
  })();

  const whereClause = { ...baseWhere };
  if (pagination.cursorValue !== undefined) {
    whereClause[pagination.sortField] = { [pagination.cursorOperator]: pagination.cursorValue };
  }

  if (!user || user.role !== 'admin') {
    whereClause.status = whereClause.status || 'open';
  }

  const jobs = await Job.findAll({
    where: whereClause,
    attributes,
    include,
    limit: pagination.limit + 1,
    order: pagination.order,
    distinct: true,
  });

  const hasNext = jobs.length > pagination.limit;
  const items = hasNext ? jobs.slice(0, pagination.limit) : jobs;
  const data = items.map(formatJob);
  const nextCursor = hasNext ? encodeCursor(items[items.length - 1][pagination.sortField]) : null;

  let analytics;
  if (String(query.analytics).toLowerCase() === 'true') {
    const total = await Job.count({ where: baseWhere, include: filterIncludes, distinct: true });
    const open = await Job.count({ where: { ...baseWhere, status: 'open' }, include: filterIncludes, distinct: true });
    const closed = await Job.count({ where: { ...baseWhere, status: 'closed' }, include: filterIncludes, distinct: true });
    analytics = { total, open, closed };
  }

  return {
    data,
    next_cursor: nextCursor,
    analytics,
  };
};

const createJob = async (user, payload) => {
  ensureCanCreateJob(user);

  const transaction = await sequelize.transaction();
  try {
    const status = payload.status || (payload.publish ? 'open' : 'draft');
    const job = await Job.create(
      {
        posted_by: user.id,
        company_id: payload.company_id || user.org_id || user.id,
        title: payload.title,
        description: payload.description,
        location: payload.location,
        job_type: payload.job_type,
        salary_min: payload.salary_min,
        salary_max: payload.salary_max,
        salary_currency: payload.salary_currency || 'USD',
        status,
        published_at: status === 'open' ? payload.published_at || new Date() : payload.published_at,
        closes_at: payload.closes_at,
        metadata: payload.metadata,
      },
      { transaction }
    );

    if (payload.tags) {
      await applyTagChanges(job.id, payload.tags, transaction);
    }

    await createPipeline(job.id, payload.stages, transaction);

    await transaction.commit();

    const created = await findJobById(job.id, {
      include: [
        { model: JobStage, as: 'stages' },
        { model: JobTag, as: 'tagAssignments', attributes: ['tag'] },
      ],
    });

    return formatJob(created);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const getJob = async (id, user, { includeDeleted = false, expand = [] } = {}) => {
  const include = [];
  const expansions = new Set(expand);
  if (expansions.has('stages')) {
    include.push({ model: JobStage, as: 'stages' });
  }
  if (expansions.has('tags')) {
    include.push({ model: JobTag, as: 'tagAssignments', attributes: ['tag'] });
  }
  if (expansions.has('owner')) {
    include.push({ model: User, as: 'owner', attributes: ['id', 'email', 'role', 'org_id'] });
  }

  const job = await findJobById(id, { includeDeleted, include });
  ensureJobAccess(job, user, { allowPublic: true });

  return formatJob(job);
};

const getJobAndTrackView = async (id, user, options) => {
  const job = await getJob(id, user, options);
  await incrementJobCounters(job.id, { views: 1 });
  return job;
};

const updateJob = async (id, user, payload) => {
  const job = await findJobById(id, { include: [{ model: JobStage, as: 'stages' }, { model: JobTag, as: 'tagAssignments', attributes: ['tag'] }] });
  ensureJobAccess(job, user);

  const transaction = await sequelize.transaction();
  try {
    const status = payload.status || job.status;
    await job.update(
      {
        title: payload.title ?? job.title,
        description: payload.description ?? job.description,
        location: payload.location ?? job.location,
        job_type: payload.job_type ?? job.job_type,
        salary_min: payload.salary_min ?? job.salary_min,
        salary_max: payload.salary_max ?? job.salary_max,
        salary_currency: payload.salary_currency ?? job.salary_currency,
        status,
        published_at:
          status === 'open'
            ? job.published_at || payload.published_at || new Date()
            : payload.published_at ?? job.published_at,
        closes_at: payload.closes_at ?? job.closes_at,
        metadata: payload.metadata ?? job.metadata,
      },
      { transaction }
    );

    if (payload.tags) {
      await applyTagChanges(job.id, payload.tags, transaction);
    }

    if (Array.isArray(payload.stages)) {
      await JobStage.destroy({ where: { job_id: job.id }, force: true, transaction });
      await createPipeline(job.id, payload.stages, transaction);
    }

    await transaction.commit();

    const refreshed = await findJobById(job.id, {
      include: [
        { model: JobStage, as: 'stages' },
        { model: JobTag, as: 'tagAssignments', attributes: ['tag'] },
      ],
    });
    return formatJob(refreshed);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const deleteJob = async (id, user) => {
  const job = await findJobById(id);
  ensureJobAccess(job, user);
  await job.destroy();
  return { success: true };
};

module.exports = {
  listJobs,
  createJob,
  getJob,
  getJobAndTrackView,
  updateJob,
  deleteJob,
  incrementJobCounters,
};
