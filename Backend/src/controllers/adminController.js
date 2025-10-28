const Joi = require('joi');
const service = require('../services/adminService');
const { persistIdempotentResponse } = require('../middleware/idempotency');

const booleanParam = Joi.boolean().truthy('true').truthy('1').truthy(1).falsy('false').falsy('0').falsy(0);

const parseListParam = (value) => {
  if (!value) return undefined;
  const values = Array.isArray(value)
    ? value
    : String(value)
        .split(',')
        .map((entry) => entry.trim());
  const filtered = values.filter((entry) => entry);
  return filtered.length ? Array.from(new Set(filtered)) : undefined;
};

const overviewSchema = Joi.object({ from: Joi.date().optional(), to: Joi.date().optional() });

const listUsersSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(25),
  cursor: Joi.string().optional(),
  sort: Joi.string().optional(),
  q: Joi.string().optional(),
  role: Joi.string().valid('user', 'freelancer', 'client', 'admin').optional(),
  status: Joi.string().optional(),
  include: Joi.string().optional(),
  includeDeleted: booleanParam.default(false),
  analytics: booleanParam.default(false),
  fields: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).optional(),
  expand: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).optional(),
});

const updateUserSchema = Joi.object({
  email: Joi.string().email().optional(),
  status: Joi.string().optional(),
  is_verified: Joi.boolean().optional(),
  role: Joi.string().valid('user', 'freelancer', 'client', 'admin').optional(),
  password: Joi.string().min(8).optional(),
  org_id: Joi.alternatives().try(Joi.string().uuid(), Joi.valid(null)).optional(),
  metadata: Joi.object().optional(),
}).min(1);

const createUserSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  role: Joi.string().valid('user', 'freelancer', 'client', 'admin').default('user'),
  status: Joi.string().optional(),
  is_verified: Joi.boolean().default(false),
  org_id: Joi.alternatives().try(Joi.string().uuid(), Joi.valid(null)).optional(),
  metadata: Joi.object().optional(),
  profile: Joi.object({
    display_name: Joi.string().optional(),
    headline: Joi.string().optional(),
    bio: Joi.string().optional(),
    location: Joi.string().optional(),
    avatar_url: Joi.string().uri().optional(),
    banner_url: Joi.string().uri().optional(),
    socials: Joi.object().optional(),
    hourly_rate: Joi.number().positive().optional(),
    currency: Joi.string().length(3).optional(),
  }).optional(),
});

const organizationQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(25),
  cursor: Joi.string().optional(),
  sort: Joi.string().optional(),
  q: Joi.string().optional(),
  status: Joi.string().optional(),
  include: Joi.string().optional(),
  includeDeleted: booleanParam.default(false),
  analytics: booleanParam.default(false),
  fields: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).optional(),
  expand: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).optional(),
});

const updateOrganizationSchema = Joi.object({
  verify: Joi.boolean().optional(),
  status: Joi.string().optional(),
  merge_into_id: Joi.string().uuid().optional(),
  name: Joi.string().optional(),
  slug: Joi.string().optional(),
  type: Joi.string().optional(),
  metadata: Joi.object().optional(),
}).min(1);

const createOrganizationSchema = Joi.object({
  name: Joi.string().required(),
  slug: Joi.string().optional(),
  type: Joi.string().valid('agency', 'company', 'nonprofit', 'collective').required(),
  owner_id: Joi.string().uuid().optional(),
  status: Joi.string().valid('active', 'inactive', 'suspended').optional(),
  metadata: Joi.object().optional(),
});

const reportsQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(25),
  cursor: Joi.string().optional(),
  sort: Joi.string().optional(),
  status: Joi.string().valid('pending', 'reviewing', 'resolved').optional(),
  subject_type: Joi.string().valid('post', 'comment', 'profile', 'message').optional(),
  analytics: booleanParam.default(false),
  fields: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).optional(),
  expand: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).optional(),
});

const reportActionSchema = Joi.object({
  status: Joi.string().valid('pending', 'reviewing', 'resolved').optional(),
  action_taken: Joi.string().optional(),
  resolution_notes: Joi.string().optional(),
  metadata: Joi.object().optional(),
}).min(1);

const marketplaceSchema = Joi.object({
  categories: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().required(),
        label: Joi.string().required(),
        floor: Joi.number().optional(),
      })
    )
    .optional(),
  floors: Joi.object().pattern(Joi.string(), Joi.number()).optional(),
  fees: Joi.object().pattern(Joi.string(), Joi.number()).optional(),
});

const singleResourceQuerySchema = Joi.object({
  include: Joi.string().optional(),
  includeDeleted: booleanParam.default(false),
  expand: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).optional(),
});

const jobsQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(25),
  cursor: Joi.string().optional(),
  sort: Joi.string().optional(),
  status: Joi.string().optional(),
  org_id: Joi.string().uuid().optional(),
  include: Joi.string().optional(),
  includeDeleted: booleanParam.default(false),
  analytics: booleanParam.default(false),
  fields: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).optional(),
  expand: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).optional(),
});

const updateJobSchema = Joi.object({
  is_sponsored: Joi.boolean().optional(),
  is_hidden: Joi.boolean().optional(),
  status: Joi.string().optional(),
  title: Joi.string().optional(),
  description: Joi.string().allow('', null).optional(),
  budget_min: Joi.number().min(0).optional(),
  budget_max: Joi.number().min(0).optional(),
  currency: Joi.string().length(3).optional(),
  metadata: Joi.object().optional(),
  published_at: Joi.date().optional(),
}).min(1);

const createJobSchema = Joi.object({
  org_id: Joi.string().uuid().required(),
  title: Joi.string().required(),
  description: Joi.string().allow('', null).optional(),
  status: Joi.string().valid('draft', 'open', 'closed', 'archived').default('draft'),
  is_sponsored: Joi.boolean().default(false),
  is_hidden: Joi.boolean().default(false),
  budget_min: Joi.number().min(0).optional(),
  budget_max: Joi.number().min(0).optional(),
  currency: Joi.string().length(3).optional(),
  metadata: Joi.object().optional(),
  published_at: Joi.date().optional(),
});

const ledgerQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(25),
  cursor: Joi.string().optional(),
  sort: Joi.string().optional(),
  type: Joi.string().valid('charge', 'payout', 'refund', 'escrow', 'fee').optional(),
  status: Joi.string().optional(),
  user_id: Joi.string().uuid().optional(),
  org_id: Joi.string().uuid().optional(),
  from: Joi.date().optional(),
  to: Joi.date().optional(),
  analytics: booleanParam.default(false),
  fields: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).optional(),
  expand: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).optional(),
});

const refundDecisionSchema = Joi.object({
  decision: Joi.string().valid('approved', 'rejected', 'processed').optional(),
});

const disputesQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(25),
  cursor: Joi.string().optional(),
  sort: Joi.string().optional(),
  status: Joi.string().optional(),
  analytics: booleanParam.default(false),
  fields: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).optional(),
  expand: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).optional(),
});

const disputeDecisionSchema = Joi.object({
  decision: Joi.string().valid('open', 'investigating', 'resolved', 'declined').optional(),
  resolution: Joi.string().optional(),
}).min(1);

const strikesQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(25),
  cursor: Joi.string().optional(),
  sort: Joi.string().optional(),
  user_id: Joi.string().uuid().optional(),
  status: Joi.string().optional(),
  analytics: booleanParam.default(false),
  fields: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).optional(),
  expand: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).optional(),
});

const createStrikeSchema = Joi.object({
  user_id: Joi.string().uuid().required(),
  reason: Joi.string().required(),
  severity: Joi.string().valid('minor', 'major', 'critical').default('minor'),
  status: Joi.string().valid('active', 'cleared').default('active'),
  expires_at: Joi.date().optional(),
  metadata: Joi.object().optional(),
});

const updateStrikeSchema = Joi.object({
  reason: Joi.string().optional(),
  severity: Joi.string().valid('minor', 'major', 'critical').optional(),
  status: Joi.string().valid('active', 'cleared').optional(),
  expires_at: Joi.date().optional(),
  metadata: Joi.object().optional(),
}).min(1);

const settingsSchema = Joi.object({
  email_templates: Joi.object().optional(),
  roles: Joi.object().optional(),
  integrations: Joi.object().optional(),
}).min(1);

const auditQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(25),
  cursor: Joi.string().optional(),
  actor: Joi.string().uuid().optional(),
  entity: Joi.string().optional(),
  entity_id: Joi.string().uuid().optional(),
  from: Joi.date().optional(),
  to: Joi.date().optional(),
  analytics: booleanParam.default(false),
  fields: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).optional(),
  expand: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).optional(),
});

const earningsQuerySchema = Joi.object({
  from: Joi.date().optional(),
  to: Joi.date().optional(),
  by: Joi.string().valid('product', 'day', 'org').default('day'),
});

const analyticsQuerySchema = Joi.object({
  from: Joi.date().optional(),
  to: Joi.date().optional(),
});

const cohortsQuerySchema = Joi.object({
  from: Joi.date().optional(),
  to: Joi.date().optional(),
  cohort: Joi.string().valid('week', 'month').default('week'),
});

const searchAnalyticsSchema = Joi.object({
  from: Joi.date().optional(),
  to: Joi.date().optional(),
});

const restoreSchema = Joi.object({ entity_type: Joi.string().required(), id: Joi.string().uuid().required() });

const overview = async (req, res, next) => {
  try {
    const payload = await overviewSchema.validateAsync(req.query, { stripUnknown: true, convert: true });
    const result = await service.overview(payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const users = async (req, res, next) => {
  try {
    const payload = await listUsersSchema.validateAsync(req.query, { stripUnknown: true, convert: true });
    payload.includeDeleted = payload.includeDeleted || payload.include === 'deleted';
    delete payload.include;
    payload.fields = parseListParam(payload.fields);
    payload.expand = parseListParam(payload.expand);
    const result = await service.listUsers(payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getUser = async (req, res, next) => {
  try {
    const payload = await singleResourceQuerySchema.validateAsync(req.query, { stripUnknown: true, convert: true });
    const result = await service.getUser(req.params.id, {
      includeDeleted: payload.includeDeleted || payload.include === 'deleted',
      expand: parseListParam(payload.expand),
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const payload = await createUserSchema.validateAsync(req.body, { stripUnknown: true, convert: true });
    const result = await service.createUser(payload, req.user.id);
    await persistIdempotentResponse(req, res, { status: 201, body: result });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const payload = await updateUserSchema.validateAsync(req.body, { stripUnknown: true, convert: true });
    const result = await service.updateUser(req.params.id, payload, req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const result = await service.deleteUser(req.params.id, req.user.id);
    await persistIdempotentResponse(req, res, { status: 200, body: result });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const impersonateUser = async (req, res, next) => {
  try {
    const result = await service.impersonateUser({
      admin: req.user,
      userId: req.params.id,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const organizations = async (req, res, next) => {
  try {
    const payload = await organizationQuerySchema.validateAsync(req.query, { stripUnknown: true, convert: true });
    payload.includeDeleted = payload.includeDeleted || payload.include === 'deleted';
    delete payload.include;
    payload.fields = parseListParam(payload.fields);
    payload.expand = parseListParam(payload.expand);
    const result = await service.listOrganizations(payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getOrganization = async (req, res, next) => {
  try {
    const payload = await singleResourceQuerySchema.validateAsync(req.query, { stripUnknown: true, convert: true });
    const result = await service.getOrganization(req.params.id, {
      includeDeleted: payload.includeDeleted || payload.include === 'deleted',
      expand: parseListParam(payload.expand),
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const createOrganization = async (req, res, next) => {
  try {
    const payload = await createOrganizationSchema.validateAsync(req.body, { stripUnknown: true, convert: true });
    const result = await service.createOrganization(payload, req.user.id);
    await persistIdempotentResponse(req, res, { status: 201, body: result });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const updateOrganizationHandler = async (req, res, next) => {
  try {
    const payload = await updateOrganizationSchema.validateAsync(req.body, { stripUnknown: true, convert: true });
    const result = await service.updateOrganization(req.params.id, payload, req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const deleteOrganization = async (req, res, next) => {
  try {
    const result = await service.deleteOrganization(req.params.id, req.user.id);
    await persistIdempotentResponse(req, res, { status: 200, body: result });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const reports = async (req, res, next) => {
  try {
    const payload = await reportsQuerySchema.validateAsync(req.query, { stripUnknown: true, convert: true });
    payload.fields = parseListParam(payload.fields);
    payload.expand = parseListParam(payload.expand);
    const result = await service.listReports(payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const reportAction = async (req, res, next) => {
  try {
    const payload = await reportActionSchema.validateAsync(req.body, { stripUnknown: true, convert: true });
    const result = await service.actOnReport(req.params.id, payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getMarketplaceConfig = async (req, res, next) => {
  try {
    const result = await service.getMarketplaceConfig();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const updateMarketplaceConfigHandler = async (req, res, next) => {
  try {
    const payload = await marketplaceSchema.validateAsync(req.body, { stripUnknown: true, convert: true });
    const result = await service.updateMarketplaceConfig(payload, req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const jobs = async (req, res, next) => {
  try {
    const payload = await jobsQuerySchema.validateAsync(req.query, { stripUnknown: true, convert: true });
    payload.includeDeleted = payload.includeDeleted || payload.include === 'deleted';
    delete payload.include;
    payload.fields = parseListParam(payload.fields);
    payload.expand = parseListParam(payload.expand);
    const result = await service.listJobs(payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getJob = async (req, res, next) => {
  try {
    const payload = await singleResourceQuerySchema.validateAsync(req.query, { stripUnknown: true, convert: true });
    const result = await service.getJob(req.params.id, {
      includeDeleted: payload.includeDeleted || payload.include === 'deleted',
      expand: parseListParam(payload.expand),
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const createJob = async (req, res, next) => {
  try {
    const payload = await createJobSchema.validateAsync(req.body, { stripUnknown: true, convert: true });
    const result = await service.createJob(payload, req.user.id);
    await persistIdempotentResponse(req, res, { status: 201, body: result });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const updateJobHandler = async (req, res, next) => {
  try {
    const payload = await updateJobSchema.validateAsync(req.body, { stripUnknown: true, convert: true });
    const result = await service.updateJob(req.params.id, payload, req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const deleteJob = async (req, res, next) => {
  try {
    const result = await service.deleteJob(req.params.id, req.user.id);
    await persistIdempotentResponse(req, res, { status: 200, body: result });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const paymentsLedger = async (req, res, next) => {
  try {
    const payload = await ledgerQuerySchema.validateAsync(req.query, { stripUnknown: true, convert: true });
    payload.fields = parseListParam(payload.fields);
    payload.expand = parseListParam(payload.expand);
    const result = await service.listLedger(payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const approvePayout = async (req, res, next) => {
  try {
    const result = await service.approvePayout({ id: req.params.id, actorId: req.user.id });
    await persistIdempotentResponse(req, res, { status: 200, body: result });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const approveRefund = async (req, res, next) => {
  try {
    const payload = await refundDecisionSchema.validateAsync(req.body, { stripUnknown: true, convert: true });
    const result = await service.approveRefund({ id: req.params.id, actorId: req.user.id, decision: payload.decision });
    await persistIdempotentResponse(req, res, { status: 200, body: result });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const disputes = async (req, res, next) => {
  try {
    const payload = await disputesQuerySchema.validateAsync(req.query, { stripUnknown: true, convert: true });
    payload.fields = parseListParam(payload.fields);
    payload.expand = parseListParam(payload.expand);
    const result = await service.listDisputes(payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const decideDispute = async (req, res, next) => {
  try {
    const payload = await disputeDecisionSchema.validateAsync(req.body, { stripUnknown: true, convert: true });
    const result = await service.decideDispute(req.params.id, payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const moderationStrikes = async (req, res, next) => {
  try {
    const payload = await strikesQuerySchema.validateAsync(req.query, { stripUnknown: true, convert: true });
    payload.fields = parseListParam(payload.fields);
    payload.expand = parseListParam(payload.expand);
    const result = await service.listModerationStrikes(payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const createModerationStrike = async (req, res, next) => {
  try {
    const payload = await createStrikeSchema.validateAsync(req.body, { stripUnknown: true, convert: true });
    const result = await service.createModerationStrike(payload, req.user.id);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const updateModerationStrikeHandler = async (req, res, next) => {
  try {
    const payload = await updateStrikeSchema.validateAsync(req.body, { stripUnknown: true, convert: true });
    const result = await service.updateModerationStrike(req.params.id, payload, req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const deleteModerationStrike = async (req, res, next) => {
  try {
    const result = await service.deleteModerationStrike(req.params.id, req.user.id);
    await persistIdempotentResponse(req, res, { status: 200, body: result });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getSettings = async (req, res, next) => {
  try {
    const result = await service.getSettings();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const updateSettingsHandler = async (req, res, next) => {
  try {
    const payload = await settingsSchema.validateAsync(req.body, { stripUnknown: true, convert: true });
    const result = await service.updateSettings(payload, req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const auditLogs = async (req, res, next) => {
  try {
    const payload = await auditQuerySchema.validateAsync(req.query, { stripUnknown: true, convert: true });
    const entity = payload.entity ? { type: payload.entity, id: payload.entity_id } : undefined;
    const result = await service.listAuditLogs({
      limit: payload.limit,
      cursor: payload.cursor,
      actor: payload.actor,
      entity,
      from: payload.from,
      to: payload.to,
      analytics: payload.analytics,
      fields: parseListParam(payload.fields),
      expand: parseListParam(payload.expand),
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const earnings = async (req, res, next) => {
  try {
    const payload = await earningsQuerySchema.validateAsync(req.query, { stripUnknown: true, convert: true });
    const result = await service.earnings(payload);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

const analyticsKpis = async (req, res, next) => {
  try {
    const payload = await analyticsQuerySchema.validateAsync(req.query, { stripUnknown: true, convert: true });
    const result = await service.analyticsKpis(payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const analyticsCohorts = async (req, res, next) => {
  try {
    const payload = await cohortsQuerySchema.validateAsync(req.query, { stripUnknown: true, convert: true });
    const result = await service.analyticsCohorts(payload);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

const analyticsSearch = async (req, res, next) => {
  try {
    const payload = await searchAnalyticsSchema.validateAsync(req.query, { stripUnknown: true, convert: true });
    const result = await service.analyticsSearch(payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const restore = async (req, res, next) => {
  try {
    const payload = await restoreSchema.validateAsync(req.body, { stripUnknown: true, convert: true });
    const result = await service.restore(payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  overview,
  users,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  impersonateUser,
  organizations,
  getOrganization,
  createOrganization,
  updateOrganization: updateOrganizationHandler,
  deleteOrganization,
  reports,
  reportAction,
  getMarketplaceConfig,
  updateMarketplaceConfig: updateMarketplaceConfigHandler,
  jobs,
  getJob,
  createJob,
  updateJob: updateJobHandler,
  deleteJob,
  paymentsLedger,
  approvePayout,
  approveRefund,
  disputes,
  decideDispute,
  moderationStrikes,
  createModerationStrike,
  updateModerationStrike: updateModerationStrikeHandler,
  deleteModerationStrike,
  getSettings,
  updateSettings: updateSettingsHandler,
  auditLogs,
  earnings,
  analyticsKpis,
  analyticsCohorts,
  analyticsSearch,
  restore,
};
