const { Op, fn, col, literal, where: whereClause } = require('sequelize');
const dayjs = require('dayjs');
const bcrypt = require('bcrypt');
const {
  sequelize,
  User,
  Profile,
  Session,
  Company,
  CompanyEmployee,
  Agency,
  AgencyMember,
  UserReport,
  MarketplaceConfig,
  Job,
  LedgerEntry,
  Wallet,
  Payout,
  Refund,
  Dispute,
  DisputeDecision,
  ModerationStrike,
  PlatformSetting,
  AdminAuditLog,
  EscrowIntent,
  Invoice,
  Message,
  SearchEvent,
} = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { buildPagination, encodeCursor, decodeCursor } = require('../utils/pagination');
const { aggregateByPeriod } = require('../utils/analytics');
const { generateToken, generateRefreshToken, tokenExpiresAt } = require('../utils/token');
const { persistIdempotentResponse } = require('../middleware/idempotency');

const SAFE_USER_FIELDS = ['id', 'email', 'role', 'status', 'is_verified', 'created_at', 'banned_at', 'ban_expires_at'];
const SAFE_ORG_FIELDS = ['id', 'name', 'slug', 'verified', 'verified_at', 'created_at', 'type'];

const recordAudit = async (actor, entityType, entityId, action, changes = {}, metadata = {}) => {
  await AdminAuditLog.create({
    actor_id: actor?.id || null,
    actor_role: actor?.role || null,
    entity_type: entityType,
    entity_id: entityId,
    action,
    changes,
    metadata,
  });
};

const normalizeBoolean = (value) => {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (['true', '1', 'yes'].includes(value.toLowerCase())) return true;
    if (['false', '0', 'no'].includes(value.toLowerCase())) return false;
  }
  return undefined;
};

const buildUserInclude = (expand) => {
  if (!expand) return [];
  const items = expand.split(',').map((item) => item.trim());
  const include = [];
  if (items.includes('profile')) {
    include.push({ model: Profile, as: 'profile', paranoid: false });
  }
  return include;
};

const buildFieldSelection = (fields, safeList) => {
  if (!fields) return safeList;
  const requested = fields
    .split(',')
    .map((field) => field.trim())
    .filter((field) => safeList.includes(field));
  return requested.length ? requested : safeList;
};

const overview = async ({ from, to }) => {
  const range = {};
  const messageRange = {};
  if (from) {
    range[Op.gte] = from;
    messageRange[Op.gte] = from;
  }
  if (to) {
    range[Op.lte] = to;
    messageRange[Op.lte] = to;
  }

  const [totalUsers, newUsers, activeUsers, totalCompanies, totalAgencies, jobsOpen, revenueRows, messageCount, openDisputes] =
    await Promise.all([
      User.count(),
      User.count({ where: { created_at: range } }),
      Session.count({
        distinct: true,
        col: 'user_id',
        where: { created_at: range, revoked_at: null },
      }),
      Company.count(),
      Agency.count(),
      Job.count({ where: { status: 'open', hidden_at: null } }),
      EscrowIntent.findAll({
        attributes: [
          [fn('COALESCE', fn('SUM', col('captured_amount')), 0), 'captured'],
          [fn('COALESCE', fn('SUM', col('fee_amount')), 0), 'fees'],
        ],
        where: {
          status: { [Op.in]: ['captured', 'refunded'] },
          ...(Object.keys(range).length
            ? {
                captured_at: range,
              }
            : {}),
        },
        raw: true,
      }),
      Message.count({ where: { created_at: messageRange } }),
      Dispute.count({ where: { status: { [Op.in]: ['open', 'under_review', 'action_required'] } } }),
    ]);

  const gmv = Number(revenueRows?.[0]?.captured || 0);
  const fees = Number(revenueRows?.[0]?.fees || 0);

  return {
    period: { from: from || null, to: to || null },
    totals: {
      users: totalUsers,
      organizations: totalCompanies + totalAgencies,
      companies: totalCompanies,
      agencies: totalAgencies,
      jobs_open: jobsOpen,
    },
    engagement: {
      new_users: newUsers,
      active_users: activeUsers,
      message_volume: messageCount,
    },
    revenue: {
      gmv,
      platform_fees: fees,
      take_rate: gmv > 0 ? Number((fees / gmv).toFixed(4)) : 0,
    },
    risk: {
      open_disputes: openDisputes,
    },
  };
};

const listUsers = async (params) => {
  const { analytics, include, fields, expand, q, role, status } = params;
  const pagination = buildPagination(params, ['created_at', 'email']);
  const { limit, cursorValue, cursorOperator, sortField, sortDirection, order } = pagination;

  const where = {};
  if (q) {
    const likeValue = `%${q.toLowerCase()}%`;
    where[Op.or] = [
      whereClause(fn('LOWER', col('User.email')), {
        [Op.like]: likeValue,
      }),
    ];
  }
  if (role) {
    where.role = role;
  }
  if (status) {
    where.status = status;
    if (status !== 'banned') {
      where.banned_at = null;
    }
  }
  if (cursorValue) {
    where[sortField] = { [cursorOperator]: cursorValue };
  }

  const paranoid = include?.split(',').includes('deleted') ? false : true;
  const attributes = buildFieldSelection(fields, SAFE_USER_FIELDS);
  const users = await User.findAll({
    where,
    order,
    limit: limit + 1,
    paranoid,
    attributes,
    include: buildUserInclude(expand),
  });

  const hasMore = users.length > limit;
  if (hasMore) {
    users.pop();
  }
  const nextCursorValue = hasMore ? users[users.length - 1]?.[sortField] : null;

  const result = {
    data: users,
    pagination: {
      next_cursor: hasMore ? encodeCursor(nextCursorValue) : null,
      sort: `${sortField}:${sortDirection}`,
    },
  };

  if (analytics) {
    const [statusBreakdown, totalBanned] = await Promise.all([
      User.findAll({
        attributes: ['status', [fn('COUNT', col('id')), 'count']],
        group: ['status'],
        raw: true,
      }),
      User.count({ where: { status: 'banned' } }),
    ]);
    result.analytics = {
      by_status: statusBreakdown.map((row) => ({ status: row.status, count: Number(row.count) })),
      banned: totalBanned,
    };
  }

  return result;
};

const updateUser = async (id, updates, currentUser) => {
  const user = await User.findByPk(id, { paranoid: false, include: [{ model: Profile, as: 'profile', paranoid: false }] });
  if (!user) {
    throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  }

  const changes = {};
  if (updates.role && updates.role !== user.role) {
    changes.role = { from: user.role, to: updates.role };
    user.role = updates.role;
  }
  if (typeof updates.is_verified === 'boolean' && updates.is_verified !== user.is_verified) {
    changes.is_verified = { from: user.is_verified, to: updates.is_verified };
    user.is_verified = updates.is_verified;
  }
  if (updates.status && updates.status !== user.status) {
    changes.status = { from: user.status, to: updates.status };
    user.status = updates.status;
  }

  if (updates.status === 'banned') {
    if (!updates.ban_reason && !user.banned_reason) {
      throw new ApiError(400, 'ban_reason is required when banning a user', 'BAN_REASON_REQUIRED');
    }
    user.banned_at = new Date();
    user.banned_reason = updates.ban_reason || user.banned_reason;
    user.ban_expires_at = updates.ban_expires_at || null;
    changes.ban = {
      reason: user.banned_reason,
      expires_at: user.ban_expires_at,
    };
  } else if (updates.status === 'active') {
    if (user.banned_at) {
      changes.ban_cleared = { from: user.banned_at, to: null };
    }
    user.banned_at = null;
    user.banned_reason = updates.ban_reason || null;
    user.ban_expires_at = null;
  } else {
    if (updates.ban_reason !== undefined) {
      user.banned_reason = updates.ban_reason;
      changes.ban_reason = updates.ban_reason;
    }
    if (updates.ban_expires_at !== undefined) {
      user.ban_expires_at = updates.ban_expires_at;
      changes.ban_expires_at = updates.ban_expires_at;
    }
  }

  await user.save();
  await recordAudit(currentUser, 'user', user.id, 'user.update', changes);
  return { data: user };
};

const impersonateUser = async (id, { expires_in }, admin, req, res) => {
  const target = await User.findByPk(id, { include: [{ model: Profile, as: 'profile', paranoid: false }] });
  if (!target) {
    throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  }

  const expiresAt = dayjs().add(expires_in, 'second').toDate();
  const session = await Session.create({
    user_id: target.id,
    user_agent: `impersonation:${admin.id}`,
    ip_address: req.ip,
    expires_at: expiresAt,
    impersonated_by: admin.id,
    impersonated_at: new Date(),
  });

  const accessToken = generateToken(
    { sub: target.id, role: target.role, sessionId: session.id },
    { expiresIn: expires_in }
  );
  const refreshToken = generateRefreshToken(
    { sub: target.id, sessionId: session.id },
    { expiresIn: Math.min(Math.max(expires_in * 2, 7200), 172800) }
  );
  session.refresh_token_hash = await bcrypt.hash(refreshToken, 10);
  await session.save();

  const payload = {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_at: tokenExpiresAt(accessToken),
    user: target,
    impersonation: {
      by: admin.id,
      expires_at: expiresAt,
    },
  };

  await persistIdempotentResponse(req, res, { status: 200, body: payload });
  await recordAudit(admin, 'user', target.id, 'user.impersonate', { expires_in });
  return payload;
};

const buildOrgFilters = (type, params) => {
  const { q, verified } = params;
  const includeDeleted = params.include?.split(',').includes('deleted');
  const conditions = [];
  const replacements = { type };
  if (q) {
    replacements.q = `%${q.toLowerCase()}%`;
    conditions.push('LOWER(name) LIKE :q');
  }
  const verifiedFilter = normalizeBoolean(verified);
  if (verifiedFilter !== undefined) {
    replacements.verified = verifiedFilter ? 1 : 0;
    conditions.push('verified = :verified');
  }
  if (!includeDeleted) {
    conditions.push('deleted_at IS NULL');
  }
  const whereClauseSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClauseSql, replacements };
};

const listOrgs = async (params) => {
  const { type } = params;
  const pagination = buildPagination(params, ['created_at', 'name']);
  const { limit, sortField, sortDirection } = pagination;
  const decodedCursor = decodeCursor(params.cursor);

  if (type === 'company' || type === 'agency') {
    const Model = type === 'company' ? Company : Agency;
    const MemberModel = type === 'company' ? CompanyEmployee : AgencyMember;
    const where = {};
    const includeDeleted = params.include?.split(',').includes('deleted');
    if (!includeDeleted) {
      where.deleted_at = null;
    }
    if (params.q) {
      const likeOperator = sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like;
      if (likeOperator === Op.like) {
        where.name = whereClause(fn('LOWER', col('name')), { [Op.like]: `%${params.q.toLowerCase()}%` });
      } else {
        where.name = { [likeOperator]: `%${params.q}%` };
      }
    }
    const verifiedFilter = normalizeBoolean(params.verified);
    if (verifiedFilter !== undefined) {
      where.verified = verifiedFilter;
    }
    if (decodedCursor) {
      where[sortField] = { [pagination.cursorOperator]: decodedCursor };
    }
    const rows = await Model.findAll({
      where,
      order: pagination.order,
      limit: limit + 1,
      paranoid: !includeDeleted,
      include: [{ model: MemberModel, as: type === 'company' ? 'employees' : 'team', attributes: ['id'], paranoid: !includeDeleted }],
    });
    const hasMore = rows.length > limit;
    if (hasMore) rows.pop();
    const nextCursor = hasMore ? encodeCursor(rows[rows.length - 1]?.[sortField]) : null;
    return {
      data: rows.map((row) => ({ ...row.toJSON(), type })),
      pagination: { next_cursor: nextCursor, sort: `${sortField}:${sortDirection}` },
    };
  }

  const { whereClauseSql, replacements } = buildOrgFilters(type, params);
  const cursorCondition = decodedCursor
    ? `${sequelize.getQueryInterface().quoteIdentifier(sortField)} ${
        sortDirection === 'DESC' ? '<' : '>'
      } :cursor`
    : null;
  if (decodedCursor) {
    replacements.cursor = decodedCursor instanceof Date ? decodedCursor.toISOString() : decodedCursor;
  }

  const buildClause = (baseWhere) => {
    const clauses = [];
    if (baseWhere) {
      clauses.push(baseWhere.replace(/^WHERE\s*/i, ''));
    }
    if (cursorCondition) {
      clauses.push(cursorCondition);
    }
    return clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  };

  const companyClause = buildClause(whereClauseSql);
  const agencyClause = buildClause(whereClauseSql);

  const query = `
    SELECT id, name, slug, verified, verified_at, created_at, updated_at, deleted_at, 'company' AS type
    FROM companies
    ${companyClause}
    UNION ALL
    SELECT id, name, slug, verified, verified_at, created_at, updated_at, deleted_at, 'agency' AS type
    FROM agencies
    ${agencyClause}
    ORDER BY ${sequelize.getQueryInterface().quoteIdentifier(sortField)} ${sortDirection}
    LIMIT :limit
  `;

  const rows = await sequelize.query(query, {
    replacements: { ...replacements, limit: limit + 1 },
    type: sequelize.QueryTypes.SELECT,
  });

  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();
  const nextCursor = hasMore ? encodeCursor(rows[rows.length - 1]?.[sortField]) : null;

  const response = {
    data: rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      verified: Boolean(row.verified),
      verified_at: row.verified_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
      type: row.type,
    })),
    pagination: { next_cursor: nextCursor, sort: `${sortField}:${sortDirection}` },
  };

  if (params.analytics) {
    const [companyCount, agencyCount] = await Promise.all([Company.count(), Agency.count()]);
    response.analytics = { companies: companyCount, agencies: agencyCount };
  }

  return response;
};

const updateOrg = async (id, body, currentUser) => {
  const { type, verify, merge_target_id, metadata } = body;
  const Model = type === 'company' ? Company : Agency;
  const MemberModel = type === 'company' ? CompanyEmployee : AgencyMember;
  const entity = await Model.findByPk(id, { paranoid: false });
  if (!entity) {
    throw new ApiError(404, 'Organization not found', 'ORG_NOT_FOUND');
  }

  return sequelize.transaction(async (transaction) => {
    const changes = {};
    if (typeof verify === 'boolean') {
      changes.verified = { from: entity.verified, to: verify };
      entity.verified = verify;
      entity.verified_at = verify ? new Date() : null;
    }
    if (metadata) {
      changes.metadata = metadata;
      entity.metadata = metadata;
    }

    if (merge_target_id) {
      if (merge_target_id === id) {
        throw new ApiError(400, 'merge_target_id must be different from source id', 'INVALID_MERGE_TARGET');
      }
      const target = await Model.findByPk(merge_target_id, { transaction });
      if (!target) {
        throw new ApiError(404, 'Target organization not found', 'MERGE_TARGET_NOT_FOUND');
      }
      await MemberModel.update(
        { [type === 'company' ? 'company_id' : 'agency_id']: target.id },
        {
          where: { [type === 'company' ? 'company_id' : 'agency_id']: entity.id },
          paranoid: false,
          transaction,
        }
      );
      await Model.destroy({ where: { id: entity.id }, transaction });
      await recordAudit(currentUser, `${type}`, entity.id, `${type}.merge`, { into: target.id });
      return { success: true, merged_into: target.id };
    }

    await entity.save({ transaction });
    await recordAudit(currentUser, `${type}`, entity.id, `${type}.update`, changes);
    return { data: entity };
  });
};

const listReports = async (params) => {
  const { analytics, status } = params;
  const pagination = buildPagination(params, ['created_at']);
  const where = {};
  if (status) {
    where.status = status;
  }
  if (pagination.cursorValue) {
    where.created_at = { [pagination.cursorOperator]: pagination.cursorValue };
  }

  const reports = await UserReport.findAll({
    where,
    order: pagination.order,
    limit: pagination.limit + 1,
    include: [
      { model: User, as: 'reporter', attributes: SAFE_USER_FIELDS },
      { model: User, as: 'reported', attributes: SAFE_USER_FIELDS },
    ],
  });

  const hasMore = reports.length > pagination.limit;
  if (hasMore) reports.pop();
  const nextCursor = hasMore ? encodeCursor(reports[reports.length - 1]?.created_at) : null;

  const response = {
    data: reports,
    pagination: { next_cursor: nextCursor, sort: `${pagination.sortField}:${pagination.sortDirection}` },
  };

  if (analytics) {
    const summary = await UserReport.findAll({
      attributes: ['status', [fn('COUNT', col('id')), 'count']],
      group: ['status'],
      raw: true,
    });
    response.analytics = summary.map((row) => ({ status: row.status, count: Number(row.count) }));
  }

  return response;
};

const suspendUser = async (userId, reason, days, actor, transaction) => {
  const user = await User.findByPk(userId, { transaction, paranoid: false });
  if (!user) return;
  user.status = 'banned';
  user.banned_at = new Date();
  user.banned_reason = reason;
  user.ban_expires_at = days ? dayjs().add(days, 'day').toDate() : null;
  await user.save({ transaction });
  await recordAudit(actor, 'user', userId, 'user.ban', { reason, days });
};

const actOnReport = async (id, body, currentUser) => {
  const report = await UserReport.findByPk(id, {
    include: [
      { model: User, as: 'reported', include: [{ model: Profile, as: 'profile' }] },
      { model: User, as: 'reporter' },
    ],
  });
  if (!report) {
    throw new ApiError(404, 'Report not found', 'REPORT_NOT_FOUND');
  }

  return sequelize.transaction(async (transaction) => {
    const updates = { status: 'actioned' };
    let result = { report: report.toJSON() };

    if (body.action === 'dismiss') {
      updates.status = 'reviewed';
    } else if (body.action === 'ban') {
      await suspendUser(report.reported_id, body.note || 'Violation of terms', body.ban_days, currentUser, transaction);
    } else if (body.action === 'strike') {
      const strike = await ModerationStrike.create(
        {
          user_id: report.reported_id,
          issued_by: currentUser.id,
          reason: body.note || report.reason || 'Policy violation',
          points: body.strike_points || 1,
        },
        { transaction }
      );
      result.strike = strike;
    } else if (body.action === 'verify') {
      await User.update({ is_verified: true }, { where: { id: report.reported_id }, transaction });
    }

    report.status = updates.status;
    await report.save({ transaction });

    await recordAudit(currentUser, 'user_report', report.id, 'report.action', body);
    return { success: true, report: report.toJSON(), ...result };
  });
};

const getMarketplaceConfig = async () => {
  const config = await MarketplaceConfig.findOne({ order: [['updated_at', 'DESC']] });
  if (!config) {
    return {
      data: {
        categories: [],
        floor_prices: {},
        fee_config: {},
      },
    };
  }
  return { data: config };
};

const updateMarketplaceConfig = async (updates, currentUser) => {
  return sequelize.transaction(async (transaction) => {
    let config = await MarketplaceConfig.findOne({ order: [['updated_at', 'DESC']], transaction, paranoid: false });
    if (!config) {
      config = await MarketplaceConfig.create({}, { transaction });
    }

    const changes = {};
    if (updates.categories) {
      changes.categories = updates.categories;
      config.categories = updates.categories;
    }
    if (updates.floor_prices) {
      changes.floor_prices = updates.floor_prices;
      config.floor_prices = updates.floor_prices;
    }
    if (updates.fee_config) {
      changes.fee_config = updates.fee_config;
      config.fee_config = updates.fee_config;
    }
    config.updated_by = currentUser.id;
    await config.save({ transaction });
    await recordAudit(currentUser, 'marketplace_config', config.id, 'marketplace.update', changes);
    return { data: config };
  });
};

const listJobs = async (params) => {
  const pagination = buildPagination(params, ['created_at', 'title']);
  const where = {};
  if (params.status) {
    where.status = params.status;
  }
  const sponsored = normalizeBoolean(params.sponsored);
  if (sponsored !== undefined) {
    where.is_sponsored = sponsored;
  }
  const hidden = normalizeBoolean(params.hidden);
  if (hidden === true) {
    where.hidden_at = { [Op.not]: null };
  } else if (hidden === false) {
    where.hidden_at = null;
  }
  if (params.q) {
    where[Op.or] = [
      whereClause(fn('LOWER', col('Job.title')), { [Op.like]: `%${params.q.toLowerCase()}%` }),
    ];
  }
  if (pagination.cursorValue) {
    where[pagination.sortField] = { [pagination.cursorOperator]: pagination.cursorValue };
  }

  const jobs = await Job.findAll({
    where,
    order: pagination.order,
    limit: pagination.limit + 1,
    include: [
      { model: User, as: 'owner', attributes: SAFE_USER_FIELDS },
      { model: User, as: 'company', attributes: SAFE_USER_FIELDS },
    ],
  });

  const hasMore = jobs.length > pagination.limit;
  if (hasMore) jobs.pop();
  const nextCursor = hasMore ? encodeCursor(jobs[jobs.length - 1]?.[pagination.sortField]) : null;
  const response = {
    data: jobs,
    pagination: { next_cursor: nextCursor, sort: `${pagination.sortField}:${pagination.sortDirection}` },
  };
  if (params.analytics) {
    const statusCounts = await Job.findAll({
      attributes: ['status', [fn('COUNT', col('id')), 'count']],
      group: ['status'],
      raw: true,
    });
    response.analytics = statusCounts.map((row) => ({ status: row.status, count: Number(row.count) }));
  }
  return response;
};

const updateJob = async (id, body, currentUser) => {
  const job = await Job.findByPk(id, { paranoid: false });
  if (!job) {
    throw new ApiError(404, 'Job not found', 'JOB_NOT_FOUND');
  }
  const changes = {};
  if (typeof body.sponsor === 'boolean' && body.sponsor !== job.is_sponsored) {
    changes.is_sponsored = { from: job.is_sponsored, to: body.sponsor };
    job.is_sponsored = body.sponsor;
  }
  if (typeof body.hide === 'boolean') {
    const nextHiddenAt = body.hide ? new Date() : null;
    if (job.hidden_at !== nextHiddenAt) {
      changes.hidden_at = { from: job.hidden_at, to: nextHiddenAt };
      job.hidden_at = nextHiddenAt;
    }
  }
  await job.save();
  await recordAudit(currentUser, 'job', job.id, 'job.update', changes, body.note ? { note: body.note } : undefined);
  return { data: job };
};

const listLedger = async (params) => {
  const pagination = buildPagination(params, ['occurred_at']);
  const where = {};
  if (params.wallet_id) {
    where.wallet_id = params.wallet_id;
  }
  if (params.category) {
    where.category = params.category;
  }
  if (params.from || params.to) {
    where.occurred_at = {};
    if (params.from) where.occurred_at[Op.gte] = params.from;
    if (params.to) where.occurred_at[Op.lte] = params.to;
  }
  if (pagination.cursorValue) {
    where.occurred_at = where.occurred_at || {};
    where.occurred_at[pagination.cursorOperator] = pagination.cursorValue;
  }

  const entries = await LedgerEntry.findAll({
    where,
    order: pagination.order,
    limit: pagination.limit + 1,
    include: [{ model: Wallet, as: 'wallet', include: [{ model: User, as: 'user', attributes: SAFE_USER_FIELDS }] }],
  });
  const hasMore = entries.length > pagination.limit;
  if (hasMore) entries.pop();
  const nextCursor = hasMore ? encodeCursor(entries[entries.length - 1]?.occurred_at) : null;
  return {
    data: entries,
    pagination: { next_cursor: nextCursor, sort: `${pagination.sortField}:${pagination.sortDirection}` },
  };
};

const approvePayout = async (id, body, currentUser, req, res) => {
  const payout = await Payout.findByPk(id, { include: [{ model: Wallet, as: 'wallet', include: [{ model: User, as: 'user' }] }] });
  if (!payout) {
    throw new ApiError(404, 'Payout not found', 'PAYOUT_NOT_FOUND');
  }
  if (payout.status !== 'processing') {
    return { success: true, payout };
  }
  payout.status = 'completed';
  payout.processed_at = new Date();
  if (body.note) {
    payout.metadata = { ...(payout.metadata || {}), admin_note: body.note };
  }
  await payout.save();
  await recordAudit(currentUser, 'payout', payout.id, 'payout.approve', body);
  const response = { success: true, payout };
  await persistIdempotentResponse(req, res, { status: 200, body: response });
  return response;
};

const approveRefund = async (id, body, currentUser, req, res) => {
  const refund = await Refund.findByPk(id, { include: [{ model: EscrowIntent, as: 'escrow' }] });
  if (!refund) {
    throw new ApiError(404, 'Refund not found', 'REFUND_NOT_FOUND');
  }
  if (refund.status !== 'pending') {
    return { success: true, refund };
  }
  refund.status = 'processed';
  refund.processed_at = new Date();
  if (body.note) {
    refund.metadata = { ...(refund.metadata || {}), admin_note: body.note };
  }
  await refund.save();
  await recordAudit(currentUser, 'refund', refund.id, 'refund.approve', body);
  const response = { success: true, refund };
  await persistIdempotentResponse(req, res, { status: 200, body: response });
  return response;
};

const listDisputes = async (params) => {
  const pagination = buildPagination(params, ['created_at']);
  const where = {};
  if (params.status) {
    where.status = params.status;
  }
  if (pagination.cursorValue) {
    where.created_at = { [pagination.cursorOperator]: pagination.cursorValue };
  }
  const disputes = await Dispute.findAll({
    where,
    order: pagination.order,
    limit: pagination.limit + 1,
    include: [
      { model: User, as: 'creator', attributes: SAFE_USER_FIELDS },
      { model: User, as: 'assignee', attributes: SAFE_USER_FIELDS },
    ],
  });
  const hasMore = disputes.length > pagination.limit;
  if (hasMore) disputes.pop();
  const nextCursor = hasMore ? encodeCursor(disputes[disputes.length - 1]?.created_at) : null;
  const response = {
    data: disputes,
    pagination: { next_cursor: nextCursor, sort: `${pagination.sortField}:${pagination.sortDirection}` },
  };
  if (params.analytics) {
    const summary = await Dispute.findAll({
      attributes: ['status', [fn('COUNT', col('id')), 'count']],
      group: ['status'],
      raw: true,
    });
    response.analytics = summary.map((row) => ({ status: row.status, count: Number(row.count) }));
  }
  return response;
};

const decideDispute = async (id, body, currentUser) => {
  const dispute = await Dispute.findByPk(id);
  if (!dispute) {
    throw new ApiError(404, 'Dispute not found', 'DISPUTE_NOT_FOUND');
  }
  return sequelize.transaction(async (transaction) => {
    const decision = await DisputeDecision.create(
      {
        dispute_id: dispute.id,
        decided_by: currentUser.id,
        decision: body.decision,
        notes: body.notes,
      },
      { transaction }
    );
    dispute.status = body.decision === 'accept_claim' ? 'resolved' : 'closed';
    dispute.resolution_summary = body.resolution || body.notes || null;
    dispute.closed_at = new Date();
    await dispute.save({ transaction });
    await recordAudit(currentUser, 'dispute', dispute.id, 'dispute.decide', body);
    return { success: true, dispute, decision };
  });
};

const listStrikes = async (params) => {
  const pagination = buildPagination(params, ['created_at']);
  const where = {};
  if (params.user_id) {
    where.user_id = params.user_id;
  }
  if (params.status) {
    where.status = params.status;
  }
  if (pagination.cursorValue) {
    where.created_at = { [pagination.cursorOperator]: pagination.cursorValue };
  }
  const strikes = await ModerationStrike.findAll({
    where,
    order: pagination.order,
    limit: pagination.limit + 1,
    include: [
      { model: User, as: 'user', attributes: SAFE_USER_FIELDS },
      { model: User, as: 'issuer', attributes: SAFE_USER_FIELDS },
    ],
  });
  const hasMore = strikes.length > pagination.limit;
  if (hasMore) strikes.pop();
  const nextCursor = hasMore ? encodeCursor(strikes[strikes.length - 1]?.created_at) : null;
  return {
    data: strikes,
    pagination: { next_cursor: nextCursor, sort: `${pagination.sortField}:${pagination.sortDirection}` },
  };
};

const createStrike = async (payload, currentUser) => {
  const strike = await ModerationStrike.create({
    user_id: payload.user_id,
    issued_by: currentUser.id,
    reason: payload.reason,
    points: payload.points,
    expires_at: payload.expires_at || null,
    metadata: payload.metadata || null,
  });
  await recordAudit(currentUser, 'moderation_strike', strike.id, 'strike.create', payload);

  const activePoints = await ModerationStrike.sum('points', {
    where: {
      user_id: payload.user_id,
      status: 'active',
    },
  });
  if (activePoints >= 3) {
    await suspendUser(payload.user_id, 'Exceeded strike threshold', 30, currentUser);
  }
  return { data: strike };
};

const updateStrike = async (id, payload, currentUser) => {
  const strike = await ModerationStrike.findByPk(id, { paranoid: false });
  if (!strike) {
    throw new ApiError(404, 'Strike not found', 'STRIKE_NOT_FOUND');
  }
  const changes = {};
  if (payload.status && payload.status !== strike.status) {
    changes.status = { from: strike.status, to: payload.status };
    strike.status = payload.status;
    if (payload.status !== 'active') {
      strike.resolved_at = new Date();
    }
  }
  if (payload.resolution_note !== undefined) {
    changes.resolution_note = payload.resolution_note;
    strike.resolution_note = payload.resolution_note;
  }
  if (payload.expires_at !== undefined) {
    changes.expires_at = payload.expires_at;
    strike.expires_at = payload.expires_at;
  }
  await strike.save();
  await recordAudit(currentUser, 'moderation_strike', strike.id, 'strike.update', changes);
  return { data: strike };
};

const getSettings = async ({ category }) => {
  const where = {};
  if (category) where.category = category;
  const settings = await PlatformSetting.findAll({ where, order: [['key', 'ASC']] });
  return { data: settings };
};

const updateSettings = async ({ settings }, currentUser) => {
  return sequelize.transaction(async (transaction) => {
    const results = [];
    for (const setting of settings) {
      const [record] = await PlatformSetting.upsert(
        {
          key: setting.key,
          category: setting.category,
          value: setting.value,
          updated_by: currentUser.id,
          updated_at: new Date(),
        },
        { transaction, returning: true }
      );
      results.push(record);
      await recordAudit(currentUser, 'platform_setting', setting.key, 'setting.update', setting);
    }
    return { data: results };
  });
};

const listAuditLogs = async (params) => {
  const pagination = buildPagination(params, ['created_at']);
  const where = {};
  if (params.actor) where.actor_id = params.actor;
  if (params.entity) where.entity_type = params.entity;
  if (params.from || params.to) {
    where.created_at = {};
    if (params.from) where.created_at[Op.gte] = params.from;
    if (params.to) where.created_at[Op.lte] = params.to;
  }
  if (pagination.cursorValue) {
    where.created_at = where.created_at || {};
    where.created_at[pagination.cursorOperator] = pagination.cursorValue;
  }
  const logs = await AdminAuditLog.findAll({
    where,
    order: pagination.order,
    limit: pagination.limit + 1,
    include: [{ model: User, as: 'actor', attributes: SAFE_USER_FIELDS }],
  });
  const hasMore = logs.length > pagination.limit;
  if (hasMore) logs.pop();
  const nextCursor = hasMore ? encodeCursor(logs[logs.length - 1]?.created_at) : null;
  return {
    data: logs,
    pagination: { next_cursor: nextCursor, sort: `${pagination.sortField}:${pagination.sortDirection}` },
  };
};

const earningsBucketExpression = (dialect, column, granularity) => {
  if (granularity === 'org') return column;
  if (granularity === 'product') return column;
  switch (granularity) {
    case 'month':
      if (dialect === 'sqlite') return `strftime('%Y-%m', ${column})`;
      if (dialect === 'mysql' || dialect === 'mariadb') return `DATE_FORMAT(${column}, '%Y-%m')`;
      return `DATE_TRUNC('month', ${column})`;
    case 'day':
    default:
      if (dialect === 'sqlite') return `strftime('%Y-%m-%d', ${column})`;
      if (dialect === 'mysql' || dialect === 'mariadb') return `DATE_FORMAT(${column}, '%Y-%m-%d')`;
      return `DATE_TRUNC('day', ${column})`;
  }
};

const earnings = async ({ from, to, by }) => {
  const dialect = sequelize.getDialect();
  const table = sequelize.getQueryInterface().quoteTable(EscrowIntent.getTableName());
  const bucketColumn = by === 'org' ? 'payee_wallet_id' : by === 'product' ? 'reference_type' : 'captured_at';
  const columnSql = `${table}.${sequelize.getQueryInterface().quoteIdentifier(bucketColumn)}`;
  const bucketExpr = earningsBucketExpression(dialect, bucketColumn === 'captured_at' ? columnSql : columnSql, by === 'day' ? 'day' : by);

  const whereParts = ["status IN ('captured','refunded')", `${table}.${sequelize.getQueryInterface().quoteIdentifier('captured_at')} IS NOT NULL`];
  const replacements = {};
  if (from) {
    whereParts.push(`${table}.${sequelize.getQueryInterface().quoteIdentifier('captured_at')} >= :from`);
    replacements.from = from;
  }
  if (to) {
    whereParts.push(`${table}.${sequelize.getQueryInterface().quoteIdentifier('captured_at')} <= :to`);
    replacements.to = to;
  }

  const query = `
    SELECT ${bucketExpr} AS bucket,
           SUM(captured_amount) AS captured,
           SUM(fee_amount) AS fees
    FROM ${table}
    WHERE ${whereParts.join(' AND ')}
    GROUP BY bucket
    ORDER BY bucket ASC
  `;

  const rows = await sequelize.query(query, { replacements, type: sequelize.QueryTypes.SELECT });

  const totalCaptured = rows.reduce((sum, row) => sum + Number(row.captured || 0), 0);
  const totalFees = rows.reduce((sum, row) => sum + Number(row.fees || 0), 0);

  let breakdown = rows.map((row) => ({
    bucket: row.bucket,
    captured: Number(row.captured || 0),
    fees: Number(row.fees || 0),
    take_rate: Number(row.captured || 0) > 0 ? Number(((Number(row.fees || 0) / Number(row.captured || 0))).toFixed(4)) : 0,
  }));

  if (by === 'org' && rows.length) {
    const walletIds = rows.map((row) => row.bucket).filter(Boolean);
    const wallets = await Wallet.findAll({
      where: { id: walletIds },
      include: [
        {
          model: User,
          as: 'user',
          attributes: SAFE_USER_FIELDS,
          include: [{ model: Profile, as: 'profile', paranoid: false }],
        },
      ],
      paranoid: false,
    });
    const walletMap = new Map(wallets.map((wallet) => [wallet.id, wallet]));
    breakdown = breakdown.map((row) => {
      const wallet = walletMap.get(row.bucket);
      if (!wallet) return row;
      const organization = wallet.user?.profile?.display_name || wallet.user?.email || row.bucket;
      return { ...row, wallet_id: row.bucket, organization };
    });
  }

  if (by === 'product') {
    breakdown = breakdown.map((row) => ({ ...row, product: row.bucket }));
  }

  return {
    period: { from: from || null, to: to || null },
    breakdown,
    totals: {
      captured: totalCaptured,
      fees: totalFees,
      take_rate: totalCaptured > 0 ? Number((totalFees / totalCaptured).toFixed(4)) : 0,
    },
  };
};

const analyticsKpis = async ({ from, to }) => {
  const sessionTable = sequelize.getQueryInterface().quoteTable(Session.getTableName());
  const revokedColumn = `${sessionTable}.${sequelize.getQueryInterface().quoteIdentifier('revoked_at')}`;
  const dau = await aggregateByPeriod(Session, 'created_at', {
    granularity: 'day',
    from,
    to,
    distinct: 'user_id',
    extraWhere: [`${revokedColumn} IS NULL`],
  });

  const messageWhere = {};
  if (from || to) {
    messageWhere.created_at = {};
    if (from) messageWhere.created_at[Op.gte] = from;
    if (to) messageWhere.created_at[Op.lte] = to;
  }

  const [mau, revenueRows, messages] = await Promise.all([
    Session.count({
      distinct: true,
      col: 'user_id',
      where: {
        created_at: {
          ...(from ? { [Op.gte]: dayjs(from).subtract(30, 'day').toDate() } : {}),
          ...(to ? { [Op.lte]: to } : {}),
        },
      },
    }),
    EscrowIntent.findAll({
      attributes: [
        [fn('COALESCE', fn('SUM', col('captured_amount')), 0), 'captured'],
        [fn('COALESCE', fn('SUM', col('fee_amount')), 0), 'fees'],
      ],
      where: {
        status: { [Op.in]: ['captured', 'refunded'] },
        ...(from || to
          ? {
              captured_at: {
                ...(from ? { [Op.gte]: from } : {}),
                ...(to ? { [Op.lte]: to } : {}),
              },
            }
          : {}),
      },
      raw: true,
    }),
    Message.count({ where: messageWhere }),
  ]);

  const gmv = Number(revenueRows?.[0]?.captured || 0);
  const fees = Number(revenueRows?.[0]?.fees || 0);

  return {
    period: { from: from || null, to: to || null },
    kpis: {
      mau,
      dau,
      gmv,
      take_rate: gmv > 0 ? Number((fees / gmv).toFixed(4)) : 0,
      message_volume: messages,
    },
  };
};

const analyticsCohorts = async ({ from, to, cohort }) => {
  const buckets = await aggregateByPeriod(User, 'created_at', {
    from,
    to,
    granularity: cohort,
  });
  return {
    period: { from: from || null, to: to || null },
    cohort,
    signups: buckets,
  };
};

const analyticsSearch = async ({ from, to }) => {
  const where = {};
  if (from || to) {
    where.occurred_at = {};
    if (from) where.occurred_at[Op.gte] = from;
    if (to) where.occurred_at[Op.lte] = to;
  }
  const [total, zeroResults, topQueries] = await Promise.all([
    SearchEvent.count({ where }),
    SearchEvent.count({ where: { ...where, zero_results: true } }),
    SearchEvent.findAll({
      attributes: ['query', [fn('COUNT', col('id')), 'count']],
      where,
      group: ['query'],
      order: [[literal('count'), 'DESC']],
      limit: 10,
      raw: true,
    }),
  ]);

  return {
    period: { from: from || null, to: to || null },
    total_searches: total,
    zero_result_rate: total > 0 ? Number((zeroResults / total).toFixed(4)) : 0,
    top_queries: topQueries.map((row) => ({ query: row.query, count: Number(row.count) })),
  };
};

const restore = async ({ entity_type, id }, currentUser) => {
  const normalized = entity_type.toLowerCase();
  if (normalized === 'company') {
    const restored = await Company.restore({ where: { id } });
    if (!restored) {
      throw new ApiError(404, 'Company not found or already active', 'RESTORE_NOT_FOUND');
    }
    await CompanyEmployee.restore({ where: { company_id: id } });
    await recordAudit(currentUser, 'company', id, 'company.restore');
    return { success: true };
  }
  if (normalized === 'agency') {
    const restored = await Agency.restore({ where: { id } });
    if (!restored) {
      throw new ApiError(404, 'Agency not found or already active', 'RESTORE_NOT_FOUND');
    }
    await AgencyMember.restore({ where: { agency_id: id } });
    await recordAudit(currentUser, 'agency', id, 'agency.restore');
    return { success: true };
  }

  const RESTORABLE_MODELS = {
    user: User,
    profile: Profile,
    job: Job,
    marketplace_config: MarketplaceConfig,
    moderation_strike: ModerationStrike,
  };
  const Model = RESTORABLE_MODELS[normalized];
  if (!Model) {
    throw new ApiError(400, 'Unsupported entity type for restore', 'UNSUPPORTED_ENTITY');
  }
  const restored = await Model.restore({ where: { id } });
  if (!restored) {
    throw new ApiError(404, 'Entity not found or already active', 'RESTORE_NOT_FOUND');
  }
  await recordAudit(currentUser, normalized, id, `${normalized}.restore`);
  return { success: true };
};

module.exports = {
  overview,
  listUsers,
  updateUser,
  impersonateUser,
  listOrgs,
  updateOrg,
  listReports,
  actOnReport,
  getMarketplaceConfig,
  updateMarketplaceConfig,
  listJobs,
  updateJob,
  listLedger,
  approvePayout,
  approveRefund,
  listDisputes,
  decideDispute,
  listStrikes,
  createStrike,
  updateStrike,
  getSettings,
  updateSettings,
  listAuditLogs,
  earnings,
  analyticsKpis,
  analyticsCohorts,
  analyticsSearch,
  restore,
};
