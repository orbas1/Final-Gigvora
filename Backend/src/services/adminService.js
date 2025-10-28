const dayjs = require('dayjs');
const bcrypt = require('bcrypt');
const { Op, fn, col, literal } = require('sequelize');
const {
  User,
  Profile,
  Organization,
  Job,
  ContentReport,
  MarketplaceConfig,
  PaymentTransaction,
  PayoutRequest,
  RefundRequest,
  Dispute,
  ModerationStrike,
  PlatformSetting,
  AuditLog,
  PlatformMetric,
  SearchQuery,
  Session,
  sequelize,
} = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { generateToken, generateRefreshToken, tokenExpiresAt } = require('../utils/token');

const encodeCursor = (offset) => Buffer.from(String(offset)).toString('base64');
const decodeCursor = (cursor) => {
  if (!cursor) return 0;
  const decoded = Buffer.from(String(cursor), 'base64').toString('utf8');
  const parsed = Number(decoded);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const buildOrder = (sort, fallback = [['created_at', 'DESC']]) => {
  if (!sort) return fallback;
  const directions = [];
  const fields = Array.isArray(sort) ? sort : String(sort).split(',');
  fields.forEach((field) => {
    const trimmed = field.trim();
    if (!trimmed) return;
    if (trimmed.startsWith('-')) {
      directions.push([trimmed.slice(1), 'DESC']);
    } else {
      directions.push([trimmed, 'ASC']);
    }
  });
  return directions.length ? directions : fallback;
};

const buildSearchPredicate = (term, fields) => {
  const lowered = `%${term.toLowerCase()}%`;
  return {
    [Op.or]: fields.map((field) =>
      sequelize.where(fn('LOWER', col(field)), {
        [Op.like]: lowered,
      })
    ),
  };
};

const paginate = async (model, { where = {}, include = [], limit = 25, cursor, paranoid = true, order, attributes }) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const offset = decodeCursor(cursor);
  const result = await model.findAndCountAll({
    where,
    include,
    limit: safeLimit,
    offset,
    order: order || [['created_at', 'DESC']],
    paranoid,
    distinct: true,
    attributes,
  });
  const nextCursor = offset + safeLimit < result.count ? encodeCursor(offset + safeLimit) : null;
  return { rows: result.rows, count: result.count, nextCursor };
};

const applyDateFilter = (where, from, to, field = 'created_at') => {
  if (!from && !to) return where;
  const range = {};
  if (from) range[Op.gte] = dayjs(from).startOf('day').toDate();
  if (to) range[Op.lte] = dayjs(to).endOf('day').toDate();
  return { ...where, [field]: range };
};

const sanitizeFields = (fields) => {
  if (!fields || !fields.length) return undefined;
  const allowed = fields.filter((field) => /^[a-zA-Z0-9_]+$/.test(field));
  const unique = Array.from(new Set(allowed));
  if (!unique.includes('id')) {
    unique.push('id');
  }
  return unique;
};

const buildIncludes = (baseIncludes = [], expand = [], map = {}) => {
  const includes = [...baseIncludes];
  if (!expand || !expand.length) {
    return includes;
  }
  const seen = new Set(includes.map((item) => item.as || item.model?.name));
  expand.forEach((key) => {
    const entry = map[key];
    if (!entry) return;
    const include = typeof entry === 'function' ? entry() : entry;
    const alias = include.as || include.model?.name;
    if (!seen.has(alias)) {
      includes.push(include);
      if (alias) {
        seen.add(alias);
      }
    }
  });
  return includes;
};

const ensureBudgetRange = (min, max) => {
  if (min !== undefined && max !== undefined && Number(min) > Number(max)) {
    throw new ApiError(400, 'budget_min cannot exceed budget_max', 'INVALID_JOB_BUDGET');
  }
};

const slugifyValue = (value) => {
  if (!value) return '';
  return value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
};

const ensureOrganizationSlug = async (value, transaction, excludeId) => {
  const base = slugifyValue(value) || 'organization';
  let candidate = base;
  let counter = 1;
  const whereBase = excludeId ? { id: { [Op.ne]: excludeId } } : {};
  while (
    await Organization.findOne({
      where: { ...whereBase, slug: candidate },
      paranoid: false,
      transaction,
    })
  ) {
    candidate = `${base}-${counter++}`;
  }
  return candidate;
};

const overview = async ({ from, to }) => {
  const whereRange = applyDateFilter({}, from, to);
  const [totalUsers, verifiedUsers, activeUsers] = await Promise.all([
    User.count({ where: whereRange }),
    User.count({ where: { ...whereRange, is_verified: true } }),
    User.count({ where: { ...whereRange, status: 'active' } }),
  ]);

  const [totalOrgs, verifiedOrgs, openJobs, sponsoredJobs] = await Promise.all([
    Organization.count({ where: applyDateFilter({}, from, to) }),
    Organization.count({ where: applyDateFilter({ verified_at: { [Op.not]: null } }, from, to, 'verified_at') }),
    Job.count({ where: applyDateFilter({ status: 'open' }, from, to) }),
    Job.count({ where: applyDateFilter({ is_sponsored: true }, from, to) }),
  ]);

  const revenueWhere = applyDateFilter({ type: 'charge', status: 'completed' }, from, to, 'occurred_at');
  const [grossVolume, payouts, refunds] = await Promise.all([
    PaymentTransaction.sum('amount', { where: revenueWhere }),
    PaymentTransaction.sum('amount', { where: applyDateFilter({ type: 'payout', status: 'completed' }, from, to, 'occurred_at') }),
    PaymentTransaction.sum('amount', { where: applyDateFilter({ type: 'refund', status: { [Op.ne]: 'cancelled' } }, from, to, 'occurred_at') }),
  ]);

  const netRevenue = (grossVolume || 0) - (payouts || 0) - (refunds || 0);
  const disputesOpen = await Dispute.count({ where: { status: { [Op.in]: ['open', 'investigating'] } } });

  return {
    users: {
      total: totalUsers,
      verified: verifiedUsers,
      active: activeUsers,
    },
    organizations: {
      total: totalOrgs,
      verified: verifiedOrgs,
    },
    jobs: {
      open: openJobs,
      sponsored: sponsoredJobs,
    },
    revenue: {
      gross_volume: Number(grossVolume || 0),
      payouts: Number(payouts || 0),
      refunds: Number(refunds || 0),
      net: Number(netRevenue || 0),
    },
    disputes: {
      open: disputesOpen,
    },
    range: { from, to },
  };
};

const listUsers = async ({ limit, cursor, sort, q, role, status, includeDeleted, analytics, fields, expand }) => {
  const where = {};
  if (role) where.role = role;
  if (status) where.status = status;
  const attributes = sanitizeFields(fields);
  const baseInclude = [{ model: Profile, as: 'profile', attributes: ['display_name', 'headline', 'location'] }];
  const include = buildIncludes(baseInclude, expand, {
    organization: { model: Organization, as: 'organization', attributes: ['id', 'name', 'slug', 'status'] },
    sessions: () => ({
      model: Session,
      as: 'sessions',
      attributes: ['id', 'ip_address', 'user_agent', 'expires_at'],
      limit: 5,
      order: [['created_at', 'DESC']],
    }),
  });
  if (q) {
    Object.assign(where, buildSearchPredicate(q, ['User.email', 'profile.display_name']));
  }

  const order = buildOrder(sort);
  const { rows, count, nextCursor } = await paginate(User, {
    where,
    include,
    limit,
    cursor,
    order,
    paranoid: !includeDeleted,
    attributes,
  });

  let analyticsPayload;
  if (analytics) {
    const statusCounts = await User.count({
      where: { ...where, status: { [Op.not]: null } },
      group: ['status'],
      paranoid: !includeDeleted,
    });
    analyticsPayload = {
      total: count,
      by_status: Array.isArray(statusCounts)
        ? statusCounts.map((entry) => ({ status: entry.status, count: Number(entry.count) }))
        : [],
      verified: await User.count({ where: { ...where, is_verified: true }, paranoid: !includeDeleted }),
    };
  }

  return {
    data: rows.map((row) => row.get({ plain: true })),
    pagination: { next_cursor: nextCursor },
    analytics: analyticsPayload,
  };
};

const updateUser = async (id, body, actorId) => {
  const user = await User.scope('withSensitive').findByPk(id, { paranoid: false });
  if (!user) {
    throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  }

  const updates = {};
  if (body.email) {
    user.email = body.email;
    updates.email = body.email;
  }
  if (body.status) {
    user.status = body.status;
    updates.status = body.status;
  }
  if (typeof body.is_verified === 'boolean') {
    user.is_verified = body.is_verified;
    updates.is_verified = body.is_verified;
  }
  if (body.role) {
    user.role = body.role;
    updates.role = body.role;
  }
  if (body.password) {
    user.password_hash = body.password;
    updates.password_changed = true;
  }
  if (body.org_id !== undefined) {
    if (body.org_id) {
      const organization = await Organization.findByPk(body.org_id);
      if (!organization) {
        throw new ApiError(400, 'Organization not found', 'ORG_NOT_FOUND');
      }
    }
    user.org_id = body.org_id || null;
    updates.org_id = body.org_id;
  }
  if (body.metadata) {
    user.metadata = body.metadata;
    updates.metadata = body.metadata;
  }

  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, 'No valid fields to update', 'NO_CHANGES');
  }

  try {
    await user.save();
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      throw new ApiError(409, 'Email already exists', 'EMAIL_IN_USE');
    }
    throw error;
  }

  await AuditLog.create({
    actor_id: actorId,
    actor_type: 'user',
    entity_type: 'user',
    entity_id: user.id,
    action: 'user.update',
    metadata: updates,
  });

  return user.get({ plain: true });
};

const createUser = async (payload, actorId) => {
  try {
    const id = await sequelize.transaction(async (transaction) => {
      if (payload.org_id) {
        const organization = await Organization.findByPk(payload.org_id, { transaction, paranoid: false });
        if (!organization || organization.deleted_at) {
          throw new ApiError(400, 'Organization not available', 'ORG_NOT_FOUND');
        }
      }

      const user = await User.create(
        {
          email: payload.email,
          password_hash: payload.password,
          role: payload.role || 'user',
          status: payload.status || 'active',
          is_verified: payload.is_verified ?? false,
          org_id: payload.org_id,
          metadata: payload.metadata,
        },
        { transaction }
      );

      if (payload.profile) {
        await Profile.create(
          {
            user_id: user.id,
            display_name: payload.profile.display_name,
            headline: payload.profile.headline,
            bio: payload.profile.bio,
            location: payload.profile.location,
            avatar_url: payload.profile.avatar_url,
            banner_url: payload.profile.banner_url,
            socials: payload.profile.socials,
            hourly_rate: payload.profile.hourly_rate,
            currency: payload.profile.currency,
          },
          { transaction }
        );
      }

      await AuditLog.create(
        {
          actor_id: actorId,
          actor_type: 'user',
          entity_type: 'user',
          entity_id: user.id,
          action: 'user.create',
          metadata: {
            email: payload.email,
            role: payload.role || 'user',
            org_id: payload.org_id,
            profile_created: Boolean(payload.profile),
          },
        },
        { transaction }
      );

      return user.id;
    });

    const created = await User.findByPk(id, {
      include: [
        { model: Profile, as: 'profile', attributes: ['display_name', 'headline', 'location', 'bio', 'avatar_url', 'banner_url'] },
        { model: Organization, as: 'organization', attributes: ['id', 'name', 'slug', 'status'] },
      ],
      paranoid: false,
    });

    return created.get({ plain: true });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      throw new ApiError(409, 'Email already exists', 'EMAIL_IN_USE');
    }
    throw error;
  }
};

const impersonateUser = async ({
  admin,
  userId,
  userAgent,
  ip,
}) => {
  const target = await User.scope('withSensitive').findByPk(userId);
  if (!target) {
    throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  }
  if (target.id === admin.id) {
    throw new ApiError(400, 'Cannot impersonate yourself', 'SELF_IMPERSONATION');
  }

  const session = await Session.create({
    user_id: target.id,
    user_agent: userAgent,
    ip_address: ip,
    expires_at: dayjs().add(1, 'day').toDate(),
  });

  const accessToken = generateToken({ sub: target.id, role: target.role, sessionId: session.id });
  const refreshToken = generateRefreshToken({ sub: target.id, sessionId: session.id }, { expiresIn: '1d' });
  session.refresh_token_hash = await bcrypt.hash(refreshToken, 10);
  await session.save();

  return {
    impersonation_for: target.id,
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_at: tokenExpiresAt(accessToken),
  };
};

const getUser = async (id, { includeDeleted, expand } = {}) => {
  const include = buildIncludes(
    [{ model: Profile, as: 'profile', attributes: ['display_name', 'headline', 'location', 'bio', 'avatar_url', 'banner_url'] }],
    expand,
    {
      organization: { model: Organization, as: 'organization', attributes: ['id', 'name', 'slug', 'status'] },
      sessions: () => ({
        model: Session,
        as: 'sessions',
        attributes: ['id', 'ip_address', 'user_agent', 'expires_at'],
        limit: 10,
        order: [['created_at', 'DESC']],
      }),
    }
  );

  const user = await User.findByPk(id, { include, paranoid: !includeDeleted });
  if (!user) {
    throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  }
  return user.get({ plain: true });
};

const deleteUser = async (id, actorId) => {
  const user = await User.findByPk(id);
  if (!user) {
    throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  }

  if (user.status !== 'deleted') {
    user.status = 'deleted';
    await user.save();
  }

  await user.destroy();

  await AuditLog.create({
    actor_id: actorId,
    actor_type: 'user',
    entity_type: 'user',
    entity_id: user.id,
    action: 'user.delete',
    metadata: { status: 'deleted' },
  });

  return { success: true };
};

const listOrganizations = async ({ limit, cursor, sort, q, status, includeDeleted, analytics, fields, expand }) => {
  const where = {};
  if (status) where.status = status;
  if (q) Object.assign(where, buildSearchPredicate(q, ['Organization.name', 'Organization.slug']));

  const attributes = sanitizeFields(fields);
  const baseInclude = [{ model: User, as: 'owner', attributes: ['id', 'email', 'role'] }];
  const include = buildIncludes(baseInclude, expand, {
    jobs: { model: Job, as: 'jobs', attributes: ['id', 'title', 'status', 'is_sponsored'] },
  });

  const { rows, count, nextCursor } = await paginate(Organization, {
    where,
    include,
    limit,
    cursor,
    order: buildOrder(sort),
    paranoid: !includeDeleted,
    attributes,
  });

  let analyticsPayload;
  if (analytics) {
    const statusCounts = await Organization.count({
      where: { ...where, status: { [Op.not]: null } },
      group: ['status'],
      paranoid: !includeDeleted,
    });
    analyticsPayload = {
      total: count,
      verified: await Organization.count({ where: { ...where, verified_at: { [Op.not]: null } }, paranoid: !includeDeleted }),
      by_status: Array.isArray(statusCounts)
        ? statusCounts.map((entry) => ({ status: entry.status, count: Number(entry.count) }))
        : [],
    };
  }

  return {
    data: rows.map((row) => row.get({ plain: true })),
    pagination: { next_cursor: nextCursor },
    analytics: analyticsPayload,
  };
};

const createOrganization = async (payload, actorId) => {
  const id = await sequelize.transaction(async (transaction) => {
    const owner = payload.owner_id
      ? await User.findByPk(payload.owner_id, { transaction, paranoid: false })
      : null;
    if (payload.owner_id && !owner) {
      throw new ApiError(400, 'Owner not found', 'OWNER_NOT_FOUND');
    }
    if (owner?.deleted_at) {
      throw new ApiError(400, 'Owner is not active', 'OWNER_NOT_AVAILABLE');
    }

    const slug = await ensureOrganizationSlug(payload.slug || payload.name, transaction);
    const organization = await Organization.create(
      {
        name: payload.name,
        slug,
        type: payload.type,
        owner_id: payload.owner_id,
        status: payload.status || 'active',
        metadata: payload.metadata,
      },
      { transaction }
    );

    if (owner) {
      owner.org_id = organization.id;
      await owner.save({ transaction });
    }

    await AuditLog.create(
      {
        actor_id: actorId,
        actor_type: 'user',
        entity_type: 'organization',
        entity_id: organization.id,
        action: 'organization.create',
        metadata: {
          owner_id: payload.owner_id,
          status: payload.status || 'active',
        },
      },
      { transaction }
    );

    return organization.id;
  });

  const created = await Organization.findByPk(id, {
    include: [{ model: User, as: 'owner', attributes: ['id', 'email', 'role'] }],
    paranoid: false,
  });

  return created.get({ plain: true });
};

const updateOrganization = async (id, body, actorId) => {
  const organization = await Organization.findByPk(id, { paranoid: false });
  if (!organization) {
    throw new ApiError(404, 'Organization not found', 'ORG_NOT_FOUND');
  }

  if (body.verify === true) {
    organization.verified_at = new Date();
  }
  if (body.verify === false) {
    organization.verified_at = null;
  }
  if (body.status) {
    organization.status = body.status;
  }
  if (body.name) {
    organization.name = body.name;
  }
  if (body.type) {
    organization.type = body.type;
  }
  if (body.metadata) {
    organization.metadata = body.metadata;
  }
  if (body.slug) {
    organization.slug = await ensureOrganizationSlug(body.slug, undefined, organization.id);
  }
  if (body.merge_into_id) {
    const target = await Organization.findByPk(body.merge_into_id, { paranoid: false });
    if (!target) {
      throw new ApiError(400, 'Merge target not found', 'MERGE_TARGET_NOT_FOUND');
    }
    organization.merged_into_id = body.merge_into_id;
  }

  await organization.save();

  await AuditLog.create({
    actor_id: actorId,
    actor_type: 'user',
    entity_type: 'organization',
    entity_id: organization.id,
    action: 'organization.update',
    metadata: body,
  });

  return organization.get({ plain: true });
};

const getOrganization = async (id, { includeDeleted, expand } = {}) => {
  const include = buildIncludes(
    [{ model: User, as: 'owner', attributes: ['id', 'email', 'role'] }],
    expand,
    {
      jobs: { model: Job, as: 'jobs', attributes: ['id', 'title', 'status', 'is_sponsored'] },
    }
  );

  const organization = await Organization.findByPk(id, { include, paranoid: !includeDeleted });
  if (!organization) {
    throw new ApiError(404, 'Organization not found', 'ORG_NOT_FOUND');
  }
  return organization.get({ plain: true });
};

const deleteOrganization = async (id, actorId) => {
  const organization = await Organization.findByPk(id);
  if (!organization) {
    throw new ApiError(404, 'Organization not found', 'ORG_NOT_FOUND');
  }

  await organization.destroy();

  await AuditLog.create({
    actor_id: actorId,
    actor_type: 'user',
    entity_type: 'organization',
    entity_id: organization.id,
    action: 'organization.delete',
    metadata: { status: 'deleted' },
  });

  return { success: true };
};

const listReports = async ({ limit, cursor, sort, status, subjectType, analytics, fields, expand }) => {
  const where = {};
  if (status) where.status = status;
  if (subjectType) where.subject_type = subjectType;

  const attributes = sanitizeFields(fields);
  const include = buildIncludes(
    [{ model: User, as: 'reporter', attributes: ['id', 'email'] }],
    expand,
    {}
  );

  const { rows, count, nextCursor } = await paginate(ContentReport, {
    where,
    include,
    limit,
    cursor,
    order: buildOrder(sort),
    attributes,
  });

  let analyticsPayload;
  if (analytics) {
    const statusCounts = await ContentReport.count({
      where: { ...where, status: { [Op.not]: null } },
      group: ['status'],
    });
    analyticsPayload = {
      total: count,
      by_status: Array.isArray(statusCounts)
        ? statusCounts.map((entry) => ({ status: entry.status, count: Number(entry.count) }))
        : [],
    };
  }

  return {
    data: rows.map((row) => row.get({ plain: true })),
    pagination: { next_cursor: nextCursor },
    analytics: analyticsPayload,
  };
};

const actOnReport = async (id, { status, action_taken, resolution_notes, metadata }) => {
  const report = await ContentReport.findByPk(id);
  if (!report) {
    throw new ApiError(404, 'Report not found', 'REPORT_NOT_FOUND');
  }

  if (status) report.status = status;
  if (action_taken) report.action_taken = action_taken;
  if (resolution_notes) report.resolution_notes = resolution_notes;
  if (metadata) report.metadata = metadata;
  if (status === 'resolved') {
    report.resolved_at = new Date();
  }

  await report.save();
  return report.get({ plain: true });
};

const getMarketplaceConfig = async () => {
  const config = await MarketplaceConfig.findOne({ order: [['updated_at', 'DESC']] });
  if (config) return config.get({ plain: true });
  return (await MarketplaceConfig.create({ categories: [], floors: {}, fees: {} })).get({ plain: true });
};

const updateMarketplaceConfig = async (payload, actorId) => {
  const current = await MarketplaceConfig.findOne({ order: [['updated_at', 'DESC']] });
  if (!current) {
    return (
      await MarketplaceConfig.create({
        categories: payload.categories || [],
        floors: payload.floors || {},
        fees: payload.fees || {},
        updated_by: actorId,
      })
    ).get({ plain: true });
  }

  if (payload.categories) current.categories = payload.categories;
  if (payload.floors) current.floors = payload.floors;
  if (payload.fees) current.fees = payload.fees;
  current.updated_by = actorId;
  await current.save();
  return current.get({ plain: true });
};

const listJobs = async ({ limit, cursor, sort, status, org_id, analytics, includeDeleted, fields, expand }) => {
  const where = {};
  if (status) where.status = status;
  if (org_id) where.org_id = org_id;

  const attributes = sanitizeFields(fields);
  const baseInclude = [{ model: Organization, as: 'organization', attributes: ['id', 'name', 'slug'] }];
  const include = buildIncludes(baseInclude, expand, {});

  const { rows, count, nextCursor } = await paginate(Job, {
    where,
    include,
    limit,
    cursor,
    order: buildOrder(sort),
    paranoid: !includeDeleted,
    attributes,
  });

  let analyticsPayload;
  if (analytics) {
    analyticsPayload = {
      total: count,
      sponsored: await Job.count({ where: { ...where, is_sponsored: true }, paranoid: !includeDeleted }),
      hidden: await Job.count({ where: { ...where, is_hidden: true }, paranoid: !includeDeleted }),
    };
  }

  return {
    data: rows.map((row) => row.get({ plain: true })),
    pagination: { next_cursor: nextCursor },
    analytics: analyticsPayload,
  };
};

const updateJob = async (id, body, actorId) => {
  const job = await Job.findByPk(id, { paranoid: false });
  if (!job) {
    throw new ApiError(404, 'Job not found', 'JOB_NOT_FOUND');
  }

  if (typeof body.is_sponsored === 'boolean') job.is_sponsored = body.is_sponsored;
  if (typeof body.is_hidden === 'boolean') job.is_hidden = body.is_hidden;
  if (body.status) job.status = body.status;
  if (body.title) job.title = body.title;
  if (body.description !== undefined) job.description = body.description;
  if (body.budget_min !== undefined) job.budget_min = body.budget_min;
  if (body.budget_max !== undefined) job.budget_max = body.budget_max;
  if (body.currency) job.currency = body.currency;
  if (body.metadata) job.metadata = body.metadata;
  if (body.published_at !== undefined) job.published_at = body.published_at;

  ensureBudgetRange(job.budget_min, job.budget_max);
  if (job.status === 'open' && !job.published_at) {
    job.published_at = new Date();
  }
  await job.save();

  await AuditLog.create({
    actor_id: actorId,
    actor_type: 'user',
    entity_type: 'job',
    entity_id: job.id,
    action: 'job.update',
    metadata: body,
  });

  return job.get({ plain: true });
};

const createJob = async (payload, actorId) => {
  ensureBudgetRange(payload.budget_min, payload.budget_max);

  const id = await sequelize.transaction(async (transaction) => {
    const organization = await Organization.findByPk(payload.org_id, { transaction, paranoid: false });
    if (!organization || organization.deleted_at) {
      throw new ApiError(404, 'Organization not found', 'ORG_NOT_FOUND');
    }

    const publishedAt = payload.published_at ?? (payload.status === 'open' ? new Date() : null);
    const job = await Job.create(
      {
        org_id: payload.org_id,
        title: payload.title,
        description: payload.description,
        status: payload.status || 'draft',
        is_sponsored: payload.is_sponsored ?? false,
        is_hidden: payload.is_hidden ?? false,
        budget_min: payload.budget_min,
        budget_max: payload.budget_max,
        currency: payload.currency,
        metadata: payload.metadata,
        published_at: publishedAt,
      },
      { transaction }
    );

    await AuditLog.create(
      {
        actor_id: actorId,
        actor_type: 'user',
        entity_type: 'job',
        entity_id: job.id,
        action: 'job.create',
        metadata: { org_id: payload.org_id, status: payload.status || 'draft' },
      },
      { transaction }
    );

    return job.id;
  });

  const job = await Job.findByPk(id, {
    include: [{ model: Organization, as: 'organization', attributes: ['id', 'name', 'slug'] }],
    paranoid: false,
  });

  return job.get({ plain: true });
};

const getJob = async (id, { includeDeleted, expand } = {}) => {
  const include = buildIncludes(
    [{ model: Organization, as: 'organization', attributes: ['id', 'name', 'slug'] }],
    expand,
    {}
  );

  const job = await Job.findByPk(id, { include, paranoid: !includeDeleted });
  if (!job) {
    throw new ApiError(404, 'Job not found', 'JOB_NOT_FOUND');
  }
  return job.get({ plain: true });
};

const deleteJob = async (id, actorId) => {
  const job = await Job.findByPk(id);
  if (!job) {
    throw new ApiError(404, 'Job not found', 'JOB_NOT_FOUND');
  }

  await job.destroy();

  await AuditLog.create({
    actor_id: actorId,
    actor_type: 'user',
    entity_type: 'job',
    entity_id: job.id,
    action: 'job.delete',
    metadata: { status: 'deleted' },
  });

  return { success: true };
};

const listLedger = async ({ limit, cursor, sort, type, status, user_id, org_id, from, to, analytics, fields, expand }) => {
  const where = {};
  if (type) where.type = type;
  if (status) where.status = status;
  if (user_id) where.user_id = user_id;
  if (org_id) where.org_id = org_id;
  Object.assign(where, applyDateFilter({}, from, to, 'occurred_at'));

  const attributes = sanitizeFields(fields);
  const include = buildIncludes(
    [
      { model: User, as: 'user', attributes: ['id', 'email'] },
      { model: Organization, as: 'organization', attributes: ['id', 'name'] },
    ],
    expand,
    {}
  );

  const { rows, count, nextCursor } = await paginate(PaymentTransaction, {
    where,
    include,
    limit,
    cursor,
    order: buildOrder(sort || '-occurred_at'),
    attributes,
  });

  const analyticsPayload = analytics
    ? {
        total: count,
        totals_by_type: await PaymentTransaction.findAll({
          attributes: ['type', [fn('SUM', col('amount')), 'total']],
          where,
          group: ['type'],
        }),
      }
    : undefined;

  return {
    data: rows.map((row) => row.get({ plain: true })),
    pagination: { next_cursor: nextCursor },
    analytics: analyticsPayload
      ? {
          total: analyticsPayload.total,
          totals_by_type: analyticsPayload.totals_by_type.map((entry) => ({
            type: entry.get ? entry.get('type') : entry.type,
            total: Number(entry.get ? entry.get('total') : entry.total),
          })),
        }
      : undefined,
  };
};

const approvePayout = async ({ id, actorId }) => {
  const request = await PayoutRequest.findByPk(id, {
    include: [{ model: PaymentTransaction, as: 'transaction' }],
  });
  if (!request) {
    throw new ApiError(404, 'Payout request not found', 'PAYOUT_NOT_FOUND');
  }
  if (request.status !== 'pending') {
    throw new ApiError(400, 'Only pending payouts can be approved', 'INVALID_PAYOUT_STATE');
  }

  request.status = 'approved';
  request.processed_by = actorId;
  request.processed_at = new Date();
  await request.save();

  if (request.transaction) {
    request.transaction.status = 'completed';
    await request.transaction.save();
  }

  await AuditLog.create({
    actor_id: actorId,
    actor_type: 'user',
    entity_type: 'payout',
    entity_id: request.id,
    action: 'payout.approve',
    metadata: { transaction_id: request.transaction_id },
  });

  return request.get({ plain: true });
};

const approveRefund = async ({ id, actorId, decision }) => {
  const request = await RefundRequest.findByPk(id, {
    include: [{ model: PaymentTransaction, as: 'transaction' }],
  });
  if (!request) {
    throw new ApiError(404, 'Refund request not found', 'REFUND_NOT_FOUND');
  }
  if (request.status !== 'pending') {
    throw new ApiError(400, 'Only pending refunds can be approved', 'INVALID_REFUND_STATE');
  }

  request.status = decision || 'approved';
  request.processed_by = actorId;
  request.processed_at = new Date();
  await request.save();

  if (request.transaction) {
    request.transaction.status = request.status === 'approved' ? 'completed' : 'cancelled';
    await request.transaction.save();
  }

  await AuditLog.create({
    actor_id: actorId,
    actor_type: 'user',
    entity_type: 'refund',
    entity_id: request.id,
    action: 'refund.process',
    metadata: { transaction_id: request.transaction_id, status: request.status },
  });

  return request.get({ plain: true });
};

const listDisputes = async ({ limit, cursor, sort, status, analytics, fields, expand }) => {
  const where = {};
  if (status) where.status = status;

  const attributes = sanitizeFields(fields);
  const include = buildIncludes(
    [
      { model: User, as: 'claimant', attributes: ['id', 'email'] },
      { model: User, as: 'respondent', attributes: ['id', 'email'] },
    ],
    expand,
    {}
  );

  const { rows, count, nextCursor } = await paginate(Dispute, {
    where,
    include,
    limit,
    cursor,
    order: buildOrder(sort),
    attributes,
  });

  let analyticsPayload;
  if (analytics) {
    const statusCounts = await Dispute.count({
      where: { ...where, status: { [Op.not]: null } },
      group: ['status'],
    });
    analyticsPayload = {
      total: count,
      by_status: Array.isArray(statusCounts)
        ? statusCounts.map((entry) => ({ status: entry.status, count: Number(entry.count) }))
        : [],
    };
  }

  return {
    data: rows.map((row) => row.get({ plain: true })),
    pagination: { next_cursor: nextCursor },
    analytics: analyticsPayload,
  };
};

const decideDispute = async (id, { decision, resolution }) => {
  const dispute = await Dispute.findByPk(id);
  if (!dispute) {
    throw new ApiError(404, 'Dispute not found', 'DISPUTE_NOT_FOUND');
  }

  if (decision) {
    dispute.status = decision;
  }
  if (resolution) {
    dispute.resolution = resolution;
  }
  if (decision === 'resolved') {
    dispute.resolved_at = new Date();
  }

  await dispute.save();
  return dispute.get({ plain: true });
};

const listModerationStrikes = async ({ limit, cursor, sort, user_id, status, analytics, fields, expand }) => {
  const where = {};
  if (user_id) where.user_id = user_id;
  if (status) where.status = status;

  const attributes = sanitizeFields(fields);
  const include = buildIncludes(
    [
      { model: User, as: 'user', attributes: ['id', 'email'] },
      { model: User, as: 'issuedBy', attributes: ['id', 'email'] },
    ],
    expand,
    {}
  );

  const { rows, count, nextCursor } = await paginate(ModerationStrike, {
    where,
    include,
    limit,
    cursor,
    order: buildOrder(sort),
    attributes,
  });

  const analyticsPayload = analytics
    ? {
        total: count,
        active: await ModerationStrike.count({ where: { ...where, status: 'active' } }),
      }
    : undefined;

  return {
    data: rows.map((row) => row.get({ plain: true })),
    pagination: { next_cursor: nextCursor },
    analytics: analyticsPayload,
  };
};

const createModerationStrike = async (payload, actorId) => {
  const strike = await ModerationStrike.create({
    user_id: payload.user_id,
    reason: payload.reason,
    severity: payload.severity,
    status: payload.status || 'active',
    expires_at: payload.expires_at,
    metadata: payload.metadata,
    issued_by: actorId,
  });
  return strike.get({ plain: true });
};

const updateModerationStrike = async (id, payload, actorId) => {
  const strike = await ModerationStrike.findByPk(id);
  if (!strike) {
    throw new ApiError(404, 'Moderation strike not found', 'STRIKE_NOT_FOUND');
  }

  if (payload.status) strike.status = payload.status;
  if (payload.reason) strike.reason = payload.reason;
  if (payload.severity) strike.severity = payload.severity;
  if (payload.expires_at) strike.expires_at = payload.expires_at;
  if (payload.metadata) strike.metadata = payload.metadata;
  await strike.save();

  await AuditLog.create({
    actor_id: actorId,
    actor_type: 'user',
    entity_type: 'moderation_strike',
    entity_id: strike.id,
    action: 'moderation_strike.update',
    metadata: payload,
  });

  return strike.get({ plain: true });
};

const deleteModerationStrike = async (id, actorId) => {
  const strike = await ModerationStrike.findByPk(id);
  if (!strike) {
    throw new ApiError(404, 'Moderation strike not found', 'STRIKE_NOT_FOUND');
  }

  await strike.destroy();

  await AuditLog.create({
    actor_id: actorId,
    actor_type: 'user',
    entity_type: 'moderation_strike',
    entity_id: id,
    action: 'moderation_strike.delete',
    metadata: { status: 'deleted' },
  });

  return { success: true };
};

const getSettings = async () => {
  const settings = await PlatformSetting.findOne({ order: [['updated_at', 'DESC']] });
  if (settings) return settings.get({ plain: true });
  return (
    await PlatformSetting.create({
      email_templates: {},
      roles: {},
      integrations: {},
    })
  ).get({ plain: true });
};

const updateSettings = async (payload, actorId) => {
  const settings = await PlatformSetting.findOne({ order: [['updated_at', 'DESC']] });
  if (!settings) {
    return (
      await PlatformSetting.create({
        email_templates: payload.email_templates || {},
        roles: payload.roles || {},
        integrations: payload.integrations || {},
        updated_by: actorId,
      })
    ).get({ plain: true });
  }

  if (payload.email_templates) settings.email_templates = payload.email_templates;
  if (payload.roles) settings.roles = payload.roles;
  if (payload.integrations) settings.integrations = payload.integrations;
  settings.updated_by = actorId;
  await settings.save();
  return settings.get({ plain: true });
};

const listAuditLogs = async ({ limit, cursor, actor, entity, from, to, analytics, fields, expand }) => {
  const where = {};
  if (actor) where.actor_id = actor;
  if (entity) {
    where.entity_type = entity.type;
    if (entity.id) where.entity_id = entity.id;
  }
  Object.assign(where, applyDateFilter({}, from, to, 'created_at'));

  const attributes = sanitizeFields(fields);
  const include = buildIncludes(
    [{ model: User, as: 'actor', attributes: ['id', 'email'] }],
    expand,
    {}
  );

  const { rows, count, nextCursor } = await paginate(AuditLog, {
    where,
    include,
    limit,
    cursor,
    order: [['created_at', 'DESC']],
    attributes,
  });

  return {
    data: rows.map((row) => row.get({ plain: true })),
    pagination: { next_cursor: nextCursor },
    analytics: analytics ? { total: count } : undefined,
  };
};

const earnings = async ({ from, to, by = 'day' }) => {
  const where = applyDateFilter({ type: 'charge', status: 'completed' }, from, to, 'occurred_at');
  let grouping;
  if (by === 'product') {
    grouping = ['related_entity'];
  } else if (by === 'org') {
    grouping = ['org_id'];
  } else {
    grouping = [literal("DATE(occurred_at)")];
  }

  const results = await PaymentTransaction.findAll({
    attributes: [
      ...(by === 'day'
        ? [[literal("DATE(occurred_at)"), 'period']]
        : by === 'org'
        ? ['org_id']
        : ['related_entity']),
      [fn('SUM', col('amount')), 'total'],
    ],
    where,
    group: grouping,
    order: [[fn('MIN', col('occurred_at')), 'ASC']],
  });

  return results.map((row) => {
    const plain = row.get({ plain: true });
    return {
      key: by === 'day' ? plain.period : by === 'org' ? plain.org_id : plain.related_entity,
      total: Number(plain.total || 0),
    };
  });
};

const analyticsKpis = async ({ from, to }) => {
  const where = applyDateFilter({}, from, to, 'recorded_for');
  const metrics = await PlatformMetric.findAll({ where });

  const aggregate = {};
  metrics.forEach((metric) => {
    const key = metric.metric;
    if (!aggregate[key]) aggregate[key] = [];
    aggregate[key].push(Number(metric.value));
  });

  const average = (arr) => (arr.length ? arr.reduce((acc, val) => acc + val, 0) / arr.length : 0);

  return {
    dau: Math.round(average(aggregate.dau || [])),
    mau: Math.round(average(aggregate.mau || [])),
    gmv: Number(((aggregate.gmv || []).reduce((a, b) => a + b, 0)).toFixed(2)),
    take_rate: Number(average(aggregate.take_rate || []).toFixed(4)),
    message_volume: Math.round(average(aggregate.message_volume || [])),
    range: { from, to },
  };
};

const analyticsCohorts = async ({ from, to, cohort = 'week' }) => {
  const where = applyDateFilter({ metric: 'cohort_retention' }, from, to, 'recorded_for');
  const metrics = await PlatformMetric.findAll({ where });
  return metrics.map((metric) => metric.get({ plain: true }));
};

const analyticsSearch = async ({ from, to }) => {
  const where = applyDateFilter({}, from, to, 'searched_at');
  const queries = await SearchQuery.findAll({
    where,
    attributes: [
      'query',
      [fn('COUNT', col('id')), 'count'],
      [fn('SUM', literal('CASE WHEN zero_result = 1 THEN 1 ELSE 0 END')), 'zero_results'],
    ],
    group: ['query'],
    order: [[literal('count'), 'DESC']],
    limit: 20,
  });

  const totals = queries.reduce(
    (acc, item) => {
      const count = Number(item.get('count'));
      const zero = Number(item.get('zero_results'));
      acc.count += count;
      acc.zero += zero;
      return acc;
    },
    { count: 0, zero: 0 }
  );

  return {
    top_queries: queries.map((item) => ({
      query: item.get('query'),
      count: Number(item.get('count')),
      zero_results: Number(item.get('zero_results')),
    })),
    zero_result_rate: totals.count ? Number((totals.zero / totals.count).toFixed(4)) : 0,
  };
};

const restore = async ({ entity_type, id }) => {
  const restorers = {
    user: () => User.restore({ where: { id } }),
    profile: () => Profile.restore({ where: { id } }),
    organization: () => Organization.restore({ where: { id } }),
    job: () => Job.restore({ where: { id } }),
    content_report: () => ContentReport.restore({ where: { id } }),
    payment_transaction: () => PaymentTransaction.restore({ where: { id } }),
    payout_request: () => PayoutRequest.restore({ where: { id } }),
    refund_request: () => RefundRequest.restore({ where: { id } }),
    dispute: () => Dispute.restore({ where: { id } }),
    moderation_strike: () => ModerationStrike.restore({ where: { id } }),
  };

  const handler = restorers[entity_type];
  if (!handler) {
    throw new ApiError(400, 'Unsupported entity type', 'UNSUPPORTED_ENTITY');
  }
  await handler();
  return { success: true };
};

module.exports = {
  overview,
  listUsers,
  createUser,
  updateUser,
  getUser,
  deleteUser,
  impersonateUser,
  listOrganizations,
  createOrganization,
  updateOrganization,
  getOrganization,
  deleteOrganization,
  listReports,
  actOnReport,
  getMarketplaceConfig,
  updateMarketplaceConfig,
  listJobs,
  createJob,
  updateJob,
  getJob,
  deleteJob,
  listLedger,
  approvePayout,
  approveRefund,
  listDisputes,
  decideDispute,
  listModerationStrikes,
  createModerationStrike,
  updateModerationStrike,
  deleteModerationStrike,
  getSettings,
  updateSettings,
  listAuditLogs,
  earnings,
  analyticsKpis,
  analyticsCohorts,
  analyticsSearch,
  restore,
};
