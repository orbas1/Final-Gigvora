const Joi = require('joi');
const service = require('../services/adminService');

const dateSchema = Joi.date();
const uuidSchema = Joi.string().uuid();

const overviewSchema = Joi.object({ from: dateSchema.optional(), to: dateSchema.optional() });

const listUsersSchema = Joi.object({
  cursor: Joi.string().optional(),
  limit: Joi.number().integer().min(1).max(200).optional(),
  sort: Joi.string().optional(),
  q: Joi.string().allow('').optional(),
  role: Joi.string().valid('user', 'freelancer', 'client', 'admin').optional(),
  status: Joi.string().valid('active', 'banned', 'suspended').optional(),
  include: Joi.string().optional(),
  fields: Joi.string().optional(),
  expand: Joi.string().optional(),
  analytics: Joi.boolean().truthy('true').falsy('false').optional(),
});

const updateUserSchema = Joi.object({
  role: Joi.string().valid('user', 'freelancer', 'client', 'admin').optional(),
  status: Joi.string().valid('active', 'banned', 'suspended').optional(),
  is_verified: Joi.boolean().optional(),
  ban_reason: Joi.string().allow('', null).optional(),
  ban_expires_at: dateSchema.allow(null).optional(),
});

const impersonateSchema = Joi.object({
  expires_in: Joi.number().integer().min(300).max(86_400).default(3600),
});

const listOrgsSchema = Joi.object({
  type: Joi.string().valid('company', 'agency', 'all').default('company'),
  cursor: Joi.string().optional(),
  limit: Joi.number().integer().min(1).max(200).optional(),
  sort: Joi.string().optional(),
  q: Joi.string().allow('').optional(),
  verified: Joi.boolean().truthy('true').falsy('false').optional(),
  include: Joi.string().optional(),
  analytics: Joi.boolean().truthy('true').falsy('false').optional(),
});

const updateOrgSchema = Joi.object({
  type: Joi.string().valid('company', 'agency').required(),
  verify: Joi.boolean().optional(),
  merge_target_id: uuidSchema.optional(),
  metadata: Joi.object().optional(),
});

const listReportsSchema = Joi.object({
  status: Joi.string().valid('pending', 'reviewed', 'actioned').optional(),
  cursor: Joi.string().optional(),
  limit: Joi.number().integer().min(1).max(200).optional(),
  sort: Joi.string().optional(),
  analytics: Joi.boolean().truthy('true').falsy('false').optional(),
});

const reportActionSchema = Joi.object({
  action: Joi.string().valid('dismiss', 'ban', 'strike', 'verify').required(),
  note: Joi.string().allow('').optional(),
  strike_points: Joi.number().integer().min(1).max(10).optional(),
  ban_days: Joi.number().integer().min(1).max(365).optional(),
});

const marketplaceUpdateSchema = Joi.object({
  categories: Joi.array()
    .items(
      Joi.object({
        slug: Joi.string().required(),
        label: Joi.string().required(),
        description: Joi.string().allow('', null).optional(),
      })
    )
    .optional(),
  floor_prices: Joi.object().pattern(Joi.string(), Joi.object().pattern(Joi.string(), Joi.number().min(0))).optional(),
  fee_config: Joi.object({
    platform_fee_percent: Joi.number().min(0).max(100).optional(),
    premium_fee_percent: Joi.number().min(0).max(100).optional(),
    payout_delay_days: Joi.number().integer().min(0).max(30).optional(),
  })
    .unknown(true)
    .optional(),
});

const listJobsSchema = Joi.object({
  status: Joi.string()
    .valid('draft', 'open', 'paused', 'closed', 'archived')
    .optional(),
  sponsored: Joi.boolean().truthy('true').falsy('false').optional(),
  hidden: Joi.boolean().truthy('true').falsy('false').optional(),
  cursor: Joi.string().optional(),
  limit: Joi.number().integer().min(1).max(200).optional(),
  sort: Joi.string().optional(),
  q: Joi.string().allow('').optional(),
  analytics: Joi.boolean().truthy('true').falsy('false').optional(),
});

const updateJobSchema = Joi.object({
  sponsor: Joi.boolean().optional(),
  hide: Joi.boolean().optional(),
  note: Joi.string().allow('').optional(),
});

const ledgerQuerySchema = Joi.object({
  wallet_id: uuidSchema.optional(),
  category: Joi.string().optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  cursor: Joi.string().optional(),
  limit: Joi.number().integer().min(1).max(200).optional(),
  sort: Joi.string().optional(),
});

const approveSchema = Joi.object({
  note: Joi.string().allow('').optional(),
});

const listDisputesSchema = Joi.object({
  status: Joi.string().valid('open', 'under_review', 'action_required', 'resolved', 'closed', 'cancelled').optional(),
  cursor: Joi.string().optional(),
  limit: Joi.number().integer().min(1).max(200).optional(),
  sort: Joi.string().optional(),
  analytics: Joi.boolean().truthy('true').falsy('false').optional(),
});

const disputeDecisionSchema = Joi.object({
  decision: Joi.string().valid('accept_claim', 'reject_claim', 'split', 'manual_resolution').required(),
  resolution: Joi.string().allow('').optional(),
  notes: Joi.string().allow('').optional(),
});

const listStrikesSchema = Joi.object({
  user_id: uuidSchema.optional(),
  status: Joi.string().valid('active', 'expired', 'revoked').optional(),
  cursor: Joi.string().optional(),
  limit: Joi.number().integer().min(1).max(200).optional(),
  sort: Joi.string().optional(),
});

const createStrikeSchema = Joi.object({
  user_id: uuidSchema.required(),
  reason: Joi.string().required(),
  points: Joi.number().integer().min(1).max(20).default(1),
  expires_at: dateSchema.allow(null).optional(),
  metadata: Joi.object().optional(),
});

const updateStrikeSchema = Joi.object({
  status: Joi.string().valid('active', 'expired', 'revoked').optional(),
  resolution_note: Joi.string().allow('', null).optional(),
  expires_at: dateSchema.allow(null).optional(),
});

const settingsQuerySchema = Joi.object({
  category: Joi.string().optional(),
});

const updateSettingsSchema = Joi.object({
  settings: Joi.array()
    .items(
      Joi.object({
        key: Joi.string().required(),
        category: Joi.string().required(),
        value: Joi.any().optional(),
      })
    )
    .min(1)
    .required(),
});

const auditQuerySchema = Joi.object({
  actor: uuidSchema.optional(),
  entity: Joi.string().optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  cursor: Joi.string().optional(),
  limit: Joi.number().integer().min(1).max(200).optional(),
  sort: Joi.string().optional(),
});

const earningsSchema = Joi.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  by: Joi.string().valid('product', 'day', 'org').default('day'),
});

const analyticsRangeSchema = Joi.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});

const cohortsSchema = analyticsRangeSchema.keys({
  cohort: Joi.string().valid('week', 'month').default('week'),
});

const searchAnalyticsSchema = analyticsRangeSchema;

const restoreSchema = Joi.object({
  entity_type: Joi.string().required(),
  id: uuidSchema.required(),
});

const handle = (fn) => async (req, res, next) => {
  try {
    const result = await fn(req, res);
    if (result !== undefined) {
      res.json(result);
    }
  } catch (error) {
    next(error);
  }
};

const overview = handle(async (req) => {
  const payload = await overviewSchema.validateAsync(req.query);
  return service.overview(payload);
});

const listUsers = handle(async (req) => {
  const payload = await listUsersSchema.validateAsync(req.query);
  return service.listUsers(payload);
});

const updateUser = handle(async (req) => {
  const updates = await updateUserSchema.validateAsync(req.body);
  return service.updateUser(req.params.id, updates, req.user);
});

const impersonateUser = handle(async (req, res) => {
  const payload = await impersonateSchema.validateAsync(req.query);
  return service.impersonateUser(req.params.id, payload, req.user, req, res);
});

const listOrgs = handle(async (req) => {
  const payload = await listOrgsSchema.validateAsync(req.query);
  return service.listOrgs(payload);
});

const updateOrg = handle(async (req) => {
  const payload = await updateOrgSchema.validateAsync(req.body);
  return service.updateOrg(req.params.id, payload, req.user);
});

const listReports = handle(async (req) => {
  const payload = await listReportsSchema.validateAsync(req.query);
  return service.listReports(payload);
});

const actOnReport = handle(async (req) => {
  const payload = await reportActionSchema.validateAsync(req.body);
  return service.actOnReport(req.params.id, payload, req.user);
});

const getMarketplaceConfig = handle(async () => service.getMarketplaceConfig());

const updateMarketplaceConfig = handle(async (req) => {
  const payload = await marketplaceUpdateSchema.validateAsync(req.body);
  return service.updateMarketplaceConfig(payload, req.user);
});

const listJobs = handle(async (req) => {
  const payload = await listJobsSchema.validateAsync(req.query);
  return service.listJobs(payload);
});

const updateJob = handle(async (req) => {
  const payload = await updateJobSchema.validateAsync(req.body);
  return service.updateJob(req.params.id, payload, req.user);
});

const listLedger = handle(async (req) => {
  const payload = await ledgerQuerySchema.validateAsync(req.query);
  return service.listLedger(payload);
});

const approvePayout = handle(async (req, res) => {
  const payload = await approveSchema.validateAsync(req.body || {});
  return service.approvePayout(req.params.id, payload, req.user, req, res);
});

const approveRefund = handle(async (req, res) => {
  const payload = await approveSchema.validateAsync(req.body || {});
  return service.approveRefund(req.params.id, payload, req.user, req, res);
});

const listDisputes = handle(async (req) => {
  const payload = await listDisputesSchema.validateAsync(req.query);
  return service.listDisputes(payload);
});

const decideDispute = handle(async (req) => {
  const payload = await disputeDecisionSchema.validateAsync(req.body);
  return service.decideDispute(req.params.id, payload, req.user);
});

const listStrikes = handle(async (req) => {
  const payload = await listStrikesSchema.validateAsync(req.query);
  return service.listStrikes(payload);
});

const createStrike = handle(async (req) => {
  const payload = await createStrikeSchema.validateAsync(req.body);
  return service.createStrike(payload, req.user);
});

const updateStrike = handle(async (req) => {
  const payload = await updateStrikeSchema.validateAsync(req.body);
  return service.updateStrike(req.params.id, payload, req.user);
});

const getSettings = handle(async (req) => {
  const payload = await settingsQuerySchema.validateAsync(req.query);
  return service.getSettings(payload);
});

const updateSettings = handle(async (req) => {
  const payload = await updateSettingsSchema.validateAsync(req.body);
  return service.updateSettings(payload, req.user);
});

const listAuditLogs = handle(async (req) => {
  const payload = await auditQuerySchema.validateAsync(req.query);
  return service.listAuditLogs(payload);
});

const earnings = handle(async (req) => {
  const payload = await earningsSchema.validateAsync(req.query);
  return service.earnings(payload);
});

const analyticsKpis = handle(async (req) => {
  const payload = await analyticsRangeSchema.validateAsync(req.query);
  return service.analyticsKpis(payload);
});

const analyticsCohorts = handle(async (req) => {
  const payload = await cohortsSchema.validateAsync(req.query);
  return service.analyticsCohorts(payload);
});

const analyticsSearch = handle(async (req) => {
  const payload = await searchAnalyticsSchema.validateAsync(req.query);
  return service.analyticsSearch(payload);
});

const restore = handle(async (req) => {
  const payload = await restoreSchema.validateAsync(req.body);
  return service.restore(payload, req.user);
});

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
