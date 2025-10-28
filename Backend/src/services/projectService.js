const { Op, fn, col, literal } = require('sequelize');
const {
  Project,
  ProjectTag,
  ProjectInvite,
  ProjectBid,
  ProjectMilestone,
  ProjectDeliverable,
  ProjectTimeLog,
  ProjectReview,
  User,
  sequelize,
} = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { buildPagination, encodeCursor } = require('../utils/pagination');

const ALLOWED_PROJECT_SORT = ['created_at', 'updated_at', 'last_activity_at', 'budget_max', 'bids_count'];
const PUBLIC_PROJECT_STATUSES = new Set(['open', 'in_progress', 'completed']);
const COLLABORATOR_BID_STATUSES = new Set(['accepted']);
const MAX_REVIEW_SCORE = 5;

const normalizeTags = (tags = []) =>
  [...new Set(tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))];

const formatProject = (project) => {
  if (!project) return project;
  const plain = project.toJSON();
  if (plain.tagAssignments) {
    plain.tags = plain.tagAssignments.map((tag) => tag.tag);
    delete plain.tagAssignments;
  }
  return plain;
};

const ensureAuthenticated = (user) => {
  if (!user) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }
};

const ensureProjectOwner = (project, user) => {
  ensureAuthenticated(user);
  if (user.role === 'admin') return;
  if (project.owner_id !== user.id) {
    throw new ApiError(403, 'Only project owners can perform this action', 'FORBIDDEN');
  }
};

const ensureCollaborator = async (project, user) => {
  ensureAuthenticated(user);
  if (user.role === 'admin' || project.owner_id === user.id) return true;
  const acceptedBid = await ProjectBid.findOne({
    where: {
      project_id: project.id,
      bidder_id: user.id,
      status: { [Op.in]: Array.from(COLLABORATOR_BID_STATUSES) },
    },
    attributes: ['id'],
    paranoid: false,
  });
  if (!acceptedBid) {
    throw new ApiError(403, 'You must be an accepted collaborator to perform this action', 'FORBIDDEN');
  }
  return true;
};

const applyTagChanges = async (projectId, tags = [], transaction) => {
  const normalized = normalizeTags(tags);
  await ProjectTag.destroy({ where: { project_id: projectId }, transaction });
  if (normalized.length) {
    await ProjectTag.bulkCreate(
      normalized.map((tag) => ({ project_id: projectId, tag })),
      { transaction }
    );
  }
  await Project.update({ tags_count: normalized.length }, { where: { id: projectId }, transaction });
};

const refreshProjectAggregates = async (projectId, transaction) => {
  const [
    invitesCount,
    bidsCount,
    milestonesCount,
    deliverablesCount,
    timeLogsCount,
    reviewsAggregate,
  ] = await Promise.all([
    ProjectInvite.count({ where: { project_id: projectId }, transaction }),
    ProjectBid.count({ where: { project_id: projectId }, transaction }),
    ProjectMilestone.count({ where: { project_id: projectId }, transaction }),
    ProjectDeliverable.count({ where: { project_id: projectId }, transaction }),
    ProjectTimeLog.count({ where: { project_id: projectId }, transaction }),
    ProjectReview.findOne({
      where: { project_id: projectId },
      attributes: [
        [fn('COUNT', col('id')), 'count'],
        [fn('AVG', col('rating')), 'avg_rating'],
      ],
      raw: true,
      transaction,
    }),
  ]);

  const updates = {
    invites_count: invitesCount,
    bids_count: bidsCount,
    milestones_count: milestonesCount,
    deliverables_count: deliverablesCount,
    timelogs_count: timeLogsCount,
    reviews_count: Number(reviewsAggregate?.count || 0),
    last_activity_at: new Date(),
  };

  if (reviewsAggregate?.avg_rating) {
    updates.rating_average = Number(Number(reviewsAggregate.avg_rating).toFixed(2));
  } else {
    updates.rating_average = null;
  }

  await Project.update(updates, { where: { id: projectId }, transaction });
};

const listProjects = async (user, query) => {
  const pagination = buildPagination(query, ALLOWED_PROJECT_SORT);
  const include = [];
  const where = {};
  const expansions = new Set(
    (query.expand || '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
  );

  if (query.owner_id) {
    where.owner_id = query.owner_id;
  }
  if (query.status) {
    where.status = query.status;
  }
  if (query.type) {
    where.project_type = query.type;
  }
  if (query.q) {
    const term = `%${String(query.q).toLowerCase()}%`;
    where[Op.or] = [
      sequelize.where(fn('LOWER', col('Project.title')), { [Op.like]: term }),
      sequelize.where(fn('LOWER', col('Project.description')), { [Op.like]: term }),
    ];
  }

  if (query.tags) {
    const tags = normalizeTags(query.tags.split(','));
    if (tags.length) {
      include.push({
        model: ProjectTag,
        as: 'tagAssignments',
        attributes: ['tag'],
        where: { tag: { [Op.in]: tags } },
        required: true,
      });
    }
  } else if (expansions.has('tags')) {
    include.push({ model: ProjectTag, as: 'tagAssignments', attributes: ['tag'] });
  }

  if (expansions.has('owner')) {
    include.push({ model: User, as: 'owner', attributes: ['id', 'email', 'role'] });
  }
  if (expansions.has('bids')) {
    include.push({ model: ProjectBid, as: 'bids', include: [{ model: User, as: 'bidder', attributes: ['id', 'email', 'role'] }] });
  }
  if (expansions.has('milestones')) {
    include.push({ model: ProjectMilestone, as: 'milestones' });
  }

  const includeDeleted = query.include === 'deleted' && user?.role === 'admin';

  const rows = await Project.findAll({
    where,
    include,
    order: pagination.order,
    limit: pagination.limit + 1,
    paranoid: !includeDeleted,
  });

  const hasNext = rows.length > pagination.limit;
  const items = rows.slice(0, pagination.limit).map(formatProject);
  const nextCursor = hasNext ? encodeCursor(rows[pagination.limit - 1][pagination.sortField]) : null;

  const response = {
    data: items,
    pageInfo: {
      nextCursor,
      hasNextPage: Boolean(hasNext && nextCursor),
    },
  };

  if (query.analytics && items.length) {
    const analytics = await Project.findAll({
      where,
      attributes: [
        [fn('COUNT', col('Project.id')), 'total'],
        [fn('SUM', literal("CASE WHEN status = 'open' THEN 1 ELSE 0 END")), 'open'],
        [fn('SUM', literal("CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END")), 'in_progress'],
        [fn('SUM', literal("COALESCE(budget_max, 0)")), 'total_budget'],
      ],
      raw: true,
      paranoid: !includeDeleted,
    });
    response.analytics = analytics[0];
  }

  return response;
};

const ensureCanCreateProject = (user) => {
  ensureAuthenticated(user);
  if (!['client', 'admin'].includes(user.role)) {
    throw new ApiError(403, 'Only clients or admins can create projects', 'FORBIDDEN');
  }
};

const createProject = async (user, payload) => {
  ensureCanCreateProject(user);
  return sequelize.transaction(async (transaction) => {
    const project = await Project.create(
      {
        owner_id: user.id,
        title: payload.title,
        description: payload.description,
        status: payload.status || 'draft',
        project_type: payload.project_type || payload.type || 'fixed',
        budget_min: payload.budget_min,
        budget_max: payload.budget_max,
        budget_currency: payload.budget_currency || 'USD',
        hourly_rate: payload.hourly_rate,
        estimated_hours: payload.estimated_hours,
        timeline: payload.timeline,
        requirements: payload.requirements,
        attachments: payload.attachments,
        metadata: payload.metadata,
      },
      { transaction }
    );

    if (payload.tags?.length) {
      await applyTagChanges(project.id, payload.tags, transaction);
    }

    await refreshProjectAggregates(project.id, transaction);

    await project.reload({
      include: [{ model: ProjectTag, as: 'tagAssignments', attributes: ['tag'] }],
      transaction,
    });

    return formatProject(project);
  });
};

const findProjectById = async (id, { includeDeleted = false, expand = [] } = {}) => {
  const include = [];
  const expansions = new Set(expand);
  if (expansions.has('tags')) {
    include.push({ model: ProjectTag, as: 'tagAssignments', attributes: ['tag'] });
  }
  if (expansions.has('invites')) {
    include.push({
      model: ProjectInvite,
      as: 'invites',
      include: [
        { model: User, as: 'inviter', attributes: ['id', 'email', 'role'] },
        { model: User, as: 'invitee', attributes: ['id', 'email', 'role'] },
      ],
    });
  }
  if (expansions.has('bids')) {
    include.push({
      model: ProjectBid,
      as: 'bids',
      include: [{ model: User, as: 'bidder', attributes: ['id', 'email', 'role'] }],
    });
  }
  if (expansions.has('milestones')) {
    include.push({ model: ProjectMilestone, as: 'milestones' });
  }
  if (expansions.has('deliverables')) {
    include.push({
      model: ProjectDeliverable,
      as: 'deliverables',
      include: [
        { model: ProjectMilestone, as: 'milestone' },
        { model: User, as: 'submitter', attributes: ['id', 'email', 'role'] },
      ],
    });
  }
  if (expansions.has('timeLogs')) {
    include.push({
      model: ProjectTimeLog,
      as: 'timeLogs',
      include: [{ model: User, as: 'user', attributes: ['id', 'email', 'role'] }],
    });
  }
  if (expansions.has('reviews')) {
    include.push({
      model: ProjectReview,
      as: 'reviews',
      include: [
        { model: User, as: 'reviewer', attributes: ['id', 'email', 'role'] },
        { model: User, as: 'reviewee', attributes: ['id', 'email', 'role'] },
      ],
    });
  }

  const project = await Project.findByPk(id, {
    include,
    paranoid: !includeDeleted,
  });
  return project;
};

const ensureProjectReadable = (project, user) => {
  if (!project) {
    throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }
  if (PUBLIC_PROJECT_STATUSES.has(project.status)) {
    return true;
  }
  if (!user) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }
  if (user.role === 'admin' || project.owner_id === user.id) {
    return true;
  }
  return ProjectBid.count({
    where: { project_id: project.id, bidder_id: user.id },
    paranoid: false,
  }).then((count) => {
    if (!count) {
      throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
    }
    return true;
  });
};

const getProject = async (id, user, { includeDeleted = false, expand = [] } = {}) => {
  const project = await findProjectById(id, { includeDeleted, expand });
  await ensureProjectReadable(project, user);
  return formatProject(project);
};

const updateProject = async (id, user, payload) => {
  const project = await findProjectById(id, { includeDeleted: user?.role === 'admin' });
  if (!project) {
    throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }
  ensureProjectOwner(project, user);

  return sequelize.transaction(async (transaction) => {
    Object.assign(project, {
      title: payload.title ?? project.title,
      description: payload.description ?? project.description,
      status: payload.status ?? project.status,
      project_type: payload.project_type || payload.type || project.project_type,
      budget_min: payload.budget_min ?? project.budget_min,
      budget_max: payload.budget_max ?? project.budget_max,
      budget_currency: payload.budget_currency ?? project.budget_currency,
      hourly_rate: payload.hourly_rate ?? project.hourly_rate,
      estimated_hours: payload.estimated_hours ?? project.estimated_hours,
      timeline: payload.timeline ?? project.timeline,
      requirements: payload.requirements ?? project.requirements,
      attachments: payload.attachments ?? project.attachments,
      metadata: payload.metadata ?? project.metadata,
    });

    await project.save({ transaction });

    if (payload.tags) {
      await applyTagChanges(project.id, payload.tags, transaction);
    }

    await refreshProjectAggregates(project.id, transaction);

    await project.reload({
      include: [{ model: ProjectTag, as: 'tagAssignments', attributes: ['tag'] }],
      transaction,
    });

    return formatProject(project);
  });
};

const deleteProject = async (id, user) => {
  const project = await Project.findByPk(id);
  if (!project) {
    throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }
  ensureProjectOwner(project, user);
  await project.destroy();
  return { success: true };
};

const listInvites = async (projectId, user) => {
  const project = await Project.findByPk(projectId);
  if (!project) {
    throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }
  ensureProjectOwner(project, user);

  const invites = await ProjectInvite.findAll({
    where: { project_id: projectId },
    include: [
      { model: User, as: 'inviter', attributes: ['id', 'email', 'role'] },
      { model: User, as: 'invitee', attributes: ['id', 'email', 'role'] },
    ],
  });

  return invites;
};

const createInvite = async (projectId, user, payload) => {
  const project = await Project.findByPk(projectId);
  if (!project) {
    throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }
  ensureProjectOwner(project, user);

  const invitee = await User.findByPk(payload.invitee_id);
  if (!invitee) {
    throw new ApiError(404, 'Invitee not found', 'INVITEE_NOT_FOUND');
  }

  const invite = await ProjectInvite.create({
    project_id: projectId,
    inviter_id: user.id,
    invitee_id: payload.invitee_id,
    status: payload.status || 'pending',
    message: payload.message,
  });

  await refreshProjectAggregates(projectId);

  return invite;
};

const listBids = async (projectId, user) => {
  const project = await Project.findByPk(projectId, { paranoid: false });
  if (!project) {
    throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }
  if (user?.role !== 'admin' && project.owner_id !== user?.id) {
    const isBidder = await ProjectBid.count({ where: { project_id: projectId, bidder_id: user?.id }, paranoid: false });
    if (!isBidder) {
      throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
    }
  }

  const bids = await ProjectBid.findAll({
    where: { project_id: projectId },
    include: [{ model: User, as: 'bidder', attributes: ['id', 'email', 'role'] }],
  });
  return bids;
};

const ensureCanBid = (user) => {
  ensureAuthenticated(user);
  if (!['freelancer', 'agency', 'admin'].includes(user.role)) {
    throw new ApiError(403, 'Only freelancer or agency accounts can bid on projects', 'FORBIDDEN');
  }
};

const createBid = async (projectId, user, payload) => {
  ensureCanBid(user);
  const project = await Project.findByPk(projectId);
  if (!project) {
    throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }
  if (!PUBLIC_PROJECT_STATUSES.has(project.status) && project.owner_id !== user.id && user.role !== 'admin') {
    throw new ApiError(403, 'Project is not accepting bids', 'PROJECT_NOT_OPEN');
  }

  const existing = await ProjectBid.findOne({
    where: { project_id: projectId, bidder_id: user.id },
  });
  if (existing) {
    throw new ApiError(409, 'You have already submitted a bid for this project', 'BID_EXISTS');
  }

  const bid = await ProjectBid.create({
    project_id: projectId,
    bidder_id: user.id,
    amount: payload.amount,
    currency: payload.currency || 'USD',
    bid_type: payload.bid_type || payload.type || project.project_type,
    hourly_rate: payload.hourly_rate,
    proposed_hours: payload.proposed_hours,
    cover_letter: payload.cover_letter,
    attachments: payload.attachments,
    status: payload.status || 'pending',
    estimated_days: payload.estimated_days,
  });

  await refreshProjectAggregates(projectId);

  return bid;
};

const updateBid = async (bidId, user, payload) => {
  const bid = await ProjectBid.findByPk(bidId, { include: [{ model: Project, as: 'project' }] });
  if (!bid) {
    throw new ApiError(404, 'Bid not found', 'BID_NOT_FOUND');
  }
  const project = bid.project;
  if (!project) {
    throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }
  const isOwner = project.owner_id === user?.id || user?.role === 'admin';
  const isBidder = bid.bidder_id === user?.id;
  if (!isOwner && !isBidder) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }

  if (payload.status && !isOwner && payload.status !== bid.status) {
    throw new ApiError(403, 'Only project owners can change bid status', 'FORBIDDEN');
  }

  const previousStatus = bid.status;

  Object.assign(bid, {
    amount: payload.amount ?? bid.amount,
    currency: payload.currency ?? bid.currency,
    bid_type: payload.bid_type || payload.type || bid.bid_type,
    hourly_rate: payload.hourly_rate ?? bid.hourly_rate,
    proposed_hours: payload.proposed_hours ?? bid.proposed_hours,
    cover_letter: payload.cover_letter ?? bid.cover_letter,
    attachments: payload.attachments ?? bid.attachments,
    status: payload.status ?? bid.status,
    estimated_days: payload.estimated_days ?? bid.estimated_days,
  });

  if (payload.status && payload.status !== previousStatus) {
    bid.decision_at = new Date();
  }

  await bid.save();
  await refreshProjectAggregates(project.id);

  return bid;
};

const deleteBid = async (bidId, user) => {
  const bid = await ProjectBid.findByPk(bidId, { include: [{ model: Project, as: 'project' }] });
  if (!bid) {
    throw new ApiError(404, 'Bid not found', 'BID_NOT_FOUND');
  }
  const project = bid.project;
  const isOwner = project.owner_id === user?.id || user?.role === 'admin';
  const isBidder = bid.bidder_id === user?.id;
  if (!isOwner && !isBidder) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }

  await bid.destroy();
  await refreshProjectAggregates(project.id);
  return { success: true };
};

const listMilestones = async (projectId, user) => {
  const project = await Project.findByPk(projectId);
  if (!project) {
    throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }
  await ensureProjectReadable(project, user);
  const milestones = await ProjectMilestone.findAll({ where: { project_id: projectId } });
  return milestones;
};

const createMilestone = async (projectId, user, payload) => {
  const project = await Project.findByPk(projectId);
  if (!project) {
    throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }
  ensureProjectOwner(project, user);

  const milestone = await ProjectMilestone.create({
    project_id: projectId,
    title: payload.title,
    description: payload.description,
    amount: payload.amount,
    currency: payload.currency || 'USD',
    due_date: payload.due_date,
    order_index: payload.order_index || 1,
    status: payload.status || 'pending',
  });

  await refreshProjectAggregates(projectId);
  return milestone;
};

const updateMilestone = async (milestoneId, user, payload) => {
  const milestone = await ProjectMilestone.findByPk(milestoneId, { include: [{ model: Project, as: 'project' }] });
  if (!milestone) {
    throw new ApiError(404, 'Milestone not found', 'MILESTONE_NOT_FOUND');
  }
  ensureProjectOwner(milestone.project, user);

  Object.assign(milestone, {
    title: payload.title ?? milestone.title,
    description: payload.description ?? milestone.description,
    amount: payload.amount ?? milestone.amount,
    currency: payload.currency ?? milestone.currency,
    due_date: payload.due_date ?? milestone.due_date,
    order_index: payload.order_index ?? milestone.order_index,
    status: payload.status ?? milestone.status,
  });

  if (payload.status && payload.status === 'released') {
    milestone.released_at = new Date();
  }
  if (payload.status && payload.status === 'completed') {
    milestone.completed_at = new Date();
  }

  await milestone.save();
  await refreshProjectAggregates(milestone.project_id);
  return milestone;
};

const deleteMilestone = async (milestoneId, user) => {
  const milestone = await ProjectMilestone.findByPk(milestoneId, { include: [{ model: Project, as: 'project' }] });
  if (!milestone) {
    throw new ApiError(404, 'Milestone not found', 'MILESTONE_NOT_FOUND');
  }
  ensureProjectOwner(milestone.project, user);
  await milestone.destroy();
  await refreshProjectAggregates(milestone.project_id);
  return { success: true };
};

const listDeliverables = async (projectId, user) => {
  const project = await Project.findByPk(projectId);
  if (!project) {
    throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }
  await ensureProjectReadable(project, user);
  const deliverables = await ProjectDeliverable.findAll({
    where: { project_id: projectId },
    include: [
      { model: ProjectMilestone, as: 'milestone' },
      { model: User, as: 'submitter', attributes: ['id', 'email', 'role'] },
    ],
  });
  return deliverables;
};

const createDeliverable = async (projectId, user, payload) => {
  const project = await Project.findByPk(projectId);
  if (!project) {
    throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }
  await ensureCollaborator(project, user);

  const deliverable = await ProjectDeliverable.create({
    project_id: projectId,
    milestone_id: payload.milestone_id,
    submitted_by: user.id,
    title: payload.title,
    description: payload.description,
    status: payload.status || 'submitted',
    file_urls: payload.file_urls,
    approved_at: payload.status === 'approved' ? new Date() : null,
    rejected_at: payload.status === 'rejected' ? new Date() : null,
  });

  await refreshProjectAggregates(projectId);
  return deliverable;
};

const updateDeliverable = async (deliverableId, user, payload) => {
  const deliverable = await ProjectDeliverable.findByPk(deliverableId, {
    include: [
      { model: Project, as: 'project' },
      { model: ProjectMilestone, as: 'milestone' },
    ],
  });
  if (!deliverable) {
    throw new ApiError(404, 'Deliverable not found', 'DELIVERABLE_NOT_FOUND');
  }
  const project = deliverable.project;
  const isOwner = project.owner_id === user?.id || user?.role === 'admin';
  const isSubmitter = deliverable.submitted_by === user?.id;
  if (!isOwner && !isSubmitter) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }

  Object.assign(deliverable, {
    milestone_id: payload.milestone_id ?? deliverable.milestone_id,
    title: payload.title ?? deliverable.title,
    description: payload.description ?? deliverable.description,
    status: payload.status ?? deliverable.status,
    file_urls: payload.file_urls ?? deliverable.file_urls,
  });

  if (payload.status === 'approved') {
    deliverable.approved_at = new Date();
    deliverable.rejected_at = null;
  }
  if (payload.status === 'rejected' || payload.status === 'changes_requested') {
    deliverable.rejected_at = new Date();
    deliverable.approved_at = null;
  }

  await deliverable.save();
  await refreshProjectAggregates(project.id);
  return deliverable;
};

const deleteDeliverable = async (deliverableId, user) => {
  const deliverable = await ProjectDeliverable.findByPk(deliverableId, {
    include: [{ model: Project, as: 'project' }],
  });
  if (!deliverable) {
    throw new ApiError(404, 'Deliverable not found', 'DELIVERABLE_NOT_FOUND');
  }
  const project = deliverable.project;
  const isOwner = project.owner_id === user?.id || user?.role === 'admin';
  const isSubmitter = deliverable.submitted_by === user?.id;
  if (!isOwner && !isSubmitter) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }

  await deliverable.destroy();
  await refreshProjectAggregates(project.id);
  return { success: true };
};

const listTimeLogs = async (projectId, user) => {
  const project = await Project.findByPk(projectId);
  if (!project) {
    throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }
  await ensureCollaborator(project, user);
  const logs = await ProjectTimeLog.findAll({
    where: { project_id: projectId },
    include: [{ model: User, as: 'user', attributes: ['id', 'email', 'role'] }],
  });
  return logs;
};

const createTimeLog = async (projectId, user, payload) => {
  const project = await Project.findByPk(projectId);
  if (!project) {
    throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }
  await ensureCollaborator(project, user);

  const log = await ProjectTimeLog.create({
    project_id: projectId,
    user_id: payload.user_id || user.id,
    started_at: payload.started_at,
    ended_at: payload.ended_at,
    duration_minutes: payload.duration_minutes,
    notes: payload.notes,
    hourly_rate: payload.hourly_rate,
    billable_amount: payload.billable_amount,
    invoice_status: payload.invoice_status || 'pending',
  });

  await refreshProjectAggregates(projectId);
  return log;
};

const updateTimeLog = async (timeLogId, user, payload) => {
  const log = await ProjectTimeLog.findByPk(timeLogId, {
    include: [{ model: Project, as: 'project' }],
  });
  if (!log) {
    throw new ApiError(404, 'Time log not found', 'TIMELOG_NOT_FOUND');
  }
  const project = log.project;
  const isOwner = project.owner_id === user?.id || user?.role === 'admin';
  const isAuthor = log.user_id === user?.id;
  if (!isOwner && !isAuthor) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }

  Object.assign(log, {
    started_at: payload.started_at ?? log.started_at,
    ended_at: payload.ended_at ?? log.ended_at,
    duration_minutes: payload.duration_minutes ?? log.duration_minutes,
    notes: payload.notes ?? log.notes,
    hourly_rate: payload.hourly_rate ?? log.hourly_rate,
    billable_amount: payload.billable_amount ?? log.billable_amount,
    invoice_status: payload.invoice_status ?? log.invoice_status,
  });

  await log.save();
  await refreshProjectAggregates(project.id);
  return log;
};

const deleteTimeLog = async (timeLogId, user) => {
  const log = await ProjectTimeLog.findByPk(timeLogId, {
    include: [{ model: Project, as: 'project' }],
  });
  if (!log) {
    throw new ApiError(404, 'Time log not found', 'TIMELOG_NOT_FOUND');
  }
  const project = log.project;
  const isOwner = project.owner_id === user?.id || user?.role === 'admin';
  const isAuthor = log.user_id === user?.id;
  if (!isOwner && !isAuthor) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }
  await log.destroy();
  await refreshProjectAggregates(project.id);
  return { success: true };
};

const listReviews = async (projectId) => {
  const reviews = await ProjectReview.findAll({
    where: { project_id: projectId },
    include: [
      { model: User, as: 'reviewer', attributes: ['id', 'email', 'role'] },
      { model: User, as: 'reviewee', attributes: ['id', 'email', 'role'] },
    ],
  });
  return reviews;
};

const ensureCanReview = async (project, user) => {
  await ensureCollaborator(project, user);
  const existing = await ProjectReview.findOne({
    where: { project_id: project.id, reviewer_id: user.id },
  });
  if (existing) {
    throw new ApiError(409, 'You have already reviewed this project', 'REVIEW_EXISTS');
  }
};

const createReview = async (projectId, user, payload) => {
  const project = await Project.findByPk(projectId);
  if (!project) {
    throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }
  await ensureCanReview(project, user);

  if (payload.rating < 1 || payload.rating > MAX_REVIEW_SCORE) {
    throw new ApiError(400, 'Rating must be between 1 and 5', 'INVALID_RATING');
  }

  const revieweeId = project.owner_id === user.id ? payload.reviewee_id : project.owner_id;

  const review = await ProjectReview.create({
    project_id: projectId,
    reviewer_id: user.id,
    reviewee_id: payload.reviewee_id || revieweeId,
    rating: payload.rating,
    communication_rating: payload.communication_rating,
    quality_rating: payload.quality_rating,
    adherence_rating: payload.adherence_rating,
    comment: payload.comment,
    private_notes: payload.private_notes,
  });

  await refreshProjectAggregates(projectId);
  return review;
};

const getRevenueAnalytics = async ({ from, to, groupBy = 'day' }) => {
  const where = {};
  if (from) {
    where.completed_at = { [Op.gte]: new Date(from) };
  }
  if (to) {
    where.completed_at = { ...(where.completed_at || {}), [Op.lte]: new Date(to) };
  }
  where.status = { [Op.in]: ['completed', 'released'] };

  const groupExpressions = {
    day: fn('DATE', col('completed_at')),
    org: col('Project.owner_id'),
    user: col('Project.owner_id'),
  };

  const groupField = groupExpressions[groupBy] || groupExpressions.day;

  const rows = await ProjectMilestone.findAll({
    where,
    attributes: [
      [groupField, 'group_key'],
      [fn('SUM', col('amount')), 'revenue'],
      [fn('COUNT', col('id')), 'milestones'],
    ],
    include: [
      {
        model: Project,
        as: 'project',
        attributes: ['id', 'owner_id', 'title', 'status'],
      },
    ],
    group: ['group_key'],
    order: [[literal('group_key'), 'ASC']],
  });

  return rows.map((row) => ({
    group: row.get('group_key'),
    revenue: Number(row.get('revenue') || 0),
    milestones: Number(row.get('milestones') || 0),
  }));
};

module.exports = {
  listProjects,
  createProject,
  getProject,
  updateProject,
  deleteProject,
  listInvites,
  createInvite,
  listBids,
  createBid,
  updateBid,
  deleteBid,
  listMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  listDeliverables,
  createDeliverable,
  updateDeliverable,
  deleteDeliverable,
  listTimeLogs,
  createTimeLog,
  updateTimeLog,
  deleteTimeLog,
  listReviews,
  createReview,
  getRevenueAnalytics,
};
