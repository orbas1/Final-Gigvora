const { Op, fn, col } = require('sequelize');
const dayjs = require('dayjs');
const {
  Project,
  ProjectInvite,
  ProjectBid,
  ProjectMilestone,
  ProjectDeliverable,
  ProjectTimeLog,
  ProjectReview,
  Tag,
  User,
  sequelize,
} = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { buildPagination, encodeCursor } = require('../utils/pagination');

const isUuid = (value) => /^[0-9a-fA-F-]{36}$/.test(String(value));

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const resolveTags = async (tags) => {
  if (!tags || !tags.length) return [];
  const tagRecords = [];
  for (const tag of tags) {
    if (isUuid(tag)) {
      const existing = await Tag.findByPk(tag);
      if (existing) tagRecords.push(existing);
    } else {
      const [record] = await Tag.findOrCreate({ where: { name: tag }, defaults: { description: null } });
      tagRecords.push(record);
    }
  }
  return tagRecords;
};

const applyTags = async (project, tags) => {
  if (!tags) return;
  const tagRecords = await resolveTags(tags);
  await project.setTags(tagRecords);
};

const buildProjectIncludes = (expandSet) => {
  const include = [];
  if (expandSet.has('owner')) {
    include.push({ model: User, as: 'owner', attributes: ['id', 'email', 'role'] });
  }
  if (expandSet.has('tags')) {
    include.push({ model: Tag, as: 'tags' });
  }
  if (expandSet.has('milestones')) {
    include.push({ model: ProjectMilestone, as: 'milestones', separate: false, order: [['sequence', 'ASC']] });
  }
  if (expandSet.has('bids')) {
    include.push({
      model: ProjectBid,
      as: 'bids',
      include: [{ model: User, as: 'bidder', attributes: ['id', 'email'] }],
      paranoid: false,
    });
  }
  if (expandSet.has('invites')) {
    include.push({
      model: ProjectInvite,
      as: 'invites',
      include: [
        { model: User, as: 'freelancer', attributes: ['id', 'email'] },
        { model: User, as: 'inviter', attributes: ['id', 'email'] },
      ],
    });
  }
  if (expandSet.has('deliverables')) {
    include.push({
      model: ProjectDeliverable,
      as: 'deliverables',
      include: [
        { model: User, as: 'submitter', attributes: ['id', 'email'] },
        { model: User, as: 'reviewer', attributes: ['id', 'email'] },
      ],
      paranoid: false,
    });
  }
  if (expandSet.has('timeLogs')) {
    include.push({
      model: ProjectTimeLog,
      as: 'timeLogs',
      include: [
        { model: User, as: 'user', attributes: ['id', 'email'] },
        { model: User, as: 'approver', attributes: ['id', 'email'] },
      ],
      paranoid: false,
    });
  }
  if (expandSet.has('reviews')) {
    include.push({
      model: ProjectReview,
      as: 'reviews',
      include: [
        { model: User, as: 'reviewer', attributes: ['id', 'email'] },
        { model: User, as: 'reviewee', attributes: ['id', 'email'] },
      ],
      paranoid: false,
    });
  }
  if (expandSet.has('awardedBid')) {
    include.push({
      model: ProjectBid,
      as: 'awardedBid',
      include: [{ model: User, as: 'bidder', attributes: ['id', 'email'] }],
      paranoid: false,
    });
  }
  return include;
};

const buildProjectWhere = (query) => {
  const where = {};
  if (query.owner_id) where.owner_id = query.owner_id;
  if (query.status) where.status = query.status;
  if (query.type) where.type = query.type;
  if (query.q) {
    const term = `%${query.q.toLowerCase()}%`;
    where[Op.or] = [
      sequelize.where(fn('lower', col('Project.title')), { [Op.like]: term }),
      sequelize.where(fn('lower', col('Project.description')), { [Op.like]: term }),
    ];
  }
  if (query.published === 'true') {
    where.published_at = { [Op.ne]: null };
  }
  if (query.from || query.to) {
    const range = {};
    if (query.from) range[Op.gte] = new Date(query.from);
    if (query.to) range[Op.lte] = new Date(query.to);
    where.created_at = range;
  }
  return where;
};

const listProjects = async (query, currentUser) => {
  const pagination = buildPagination(query, ['created_at', 'updated_at', 'published_at']);
  const expand = new Set(toArray(query.expand));
  const fields = toArray(query.fields);
  const includeDeleted = currentUser?.role === 'admin' && toArray(query.include).includes('deleted');
  const tagFilters = toArray(query.tags);

  const where = buildProjectWhere(query);
  if (pagination.cursorValue !== undefined) {
    where[pagination.sortField] = {
      ...(where[pagination.sortField] || {}),
      [pagination.cursorOperator]: pagination.cursorValue,
    };
  }

  const include = buildProjectIncludes(expand);

  if (tagFilters.length) {
    include.push({
      model: Tag,
      as: 'tags',
      required: true,
      where: { name: { [Op.in]: tagFilters } },
      through: { attributes: [] },
    });
  }

  const attributes = fields.length
    ? Array.from(new Set([...fields, 'id', pagination.sortField]))
    : undefined;

  const { rows, count } = await Project.findAndCountAll({
    where,
    include,
    attributes,
    paranoid: !includeDeleted,
    limit: pagination.limit + 1,
    order: pagination.order,
    distinct: true,
  });

  const hasMore = rows.length > pagination.limit;
  const dataRows = hasMore ? rows.slice(0, pagination.limit) : rows;
  const data = dataRows.map((row) => row.toJSON());
  const nextCursorValue = hasMore ? dataRows[dataRows.length - 1][pagination.sortField] : undefined;
  const nextCursor = hasMore ? encodeCursor(nextCursorValue) : null;

  let analytics;
  if (query.analytics === 'true') {
    const [total, open, inProgress, completed, avgBudget] = await Promise.all([
      Project.count(),
      Project.count({ where: { status: 'open' } }),
      Project.count({ where: { status: 'in_progress' } }),
      Project.count({ where: { status: 'completed' } }),
      Project.sum('budget_max'),
    ]);
    analytics = {
      total_projects: total,
      open_projects: open,
      active_projects: inProgress,
      completed_projects: completed,
      avg_budget_max: total ? Number((Number(avgBudget || 0) / total).toFixed(2)) : 0,
    };
  }

  return {
    data,
    total: typeof count === 'number' ? count : Array.isArray(count) ? count.length : data.length,
    page: {
      next_cursor: nextCursor,
      limit: pagination.limit,
    },
    analytics,
  };
};

const createProject = async (ownerId, body) => {
  return sequelize.transaction(async (transaction) => {
    const project = await Project.create(
      {
        owner_id: ownerId,
        title: body.title,
        description: body.description,
        type: body.type || 'fixed',
        status: body.status || 'draft',
        budget_min: body.budget_min,
        budget_max: body.budget_max,
        currency: body.currency || 'USD',
        location: body.location,
        published_at: body.status === 'open' ? new Date() : body.published_at,
        due_date: body.due_date,
        metadata: body.metadata,
      },
      { transaction }
    );

    if (body.tags) {
      const tags = await resolveTags(toArray(body.tags));
      await project.setTags(tags, { transaction });
    }

    if (body.milestones?.length) {
      let sequence = 0;
      for (const milestone of body.milestones) {
        if (typeof milestone.sequence === 'number') {
          sequence = milestone.sequence;
        } else {
          sequence += 1;
        }
        await ProjectMilestone.create(
          {
            project_id: project.id,
            title: milestone.title,
            description: milestone.description,
            amount: milestone.amount,
            currency: milestone.currency || project.currency,
            due_date: milestone.due_date,
            sequence,
          },
          { transaction }
        );
      }
    }

    return project.reload({ include: [{ model: Tag, as: 'tags' }] });
  });
};

const getProject = async (id, query, currentUser) => {
  const expand = new Set(toArray(query?.expand));
  const includeDeleted = currentUser?.role === 'admin' && toArray(query?.include).includes('deleted');
  const project = await Project.findByPk(id, {
    include: buildProjectIncludes(expand),
    paranoid: !includeDeleted,
  });
  if (!project) throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  return project;
};

const assertProjectOwner = (project, user) => {
  if (!user) throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  if (project.owner_id !== user.id && user.role !== 'admin') {
    throw new ApiError(403, 'Only the project owner can perform this action', 'FORBIDDEN');
  }
};

const updateProject = async (id, user, body) => {
  const project = await Project.findByPk(id, { include: [{ model: Tag, as: 'tags' }] });
  if (!project) throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  assertProjectOwner(project, user);

  const fields = [
    'title',
    'description',
    'type',
    'status',
    'budget_min',
    'budget_max',
    'currency',
    'location',
    'due_date',
    'metadata',
    'published_at',
  ];
  for (const field of fields) {
    if (body[field] !== undefined) {
      project[field] = body[field];
    }
  }
  if (body.status === 'open' && !project.published_at) {
    project.published_at = new Date();
  }
  await project.save();

  if (body.tags) {
    await applyTags(project, toArray(body.tags));
  }

  return project.reload({ include: [{ model: Tag, as: 'tags' }] });
};

const deleteProject = async (id, user) => {
  const project = await Project.findByPk(id);
  if (!project) throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  assertProjectOwner(project, user);
  await project.destroy();
  return { success: true };
};

const listInvites = async (projectId, user) => {
  const project = await Project.findByPk(projectId);
  if (!project) throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  if (user.role !== 'admin' && project.owner_id !== user.id) {
    return ProjectInvite.findAll({
      where: { project_id: projectId, freelancer_id: user.id },
      include: [
        { model: User, as: 'freelancer', attributes: ['id', 'email'] },
        { model: User, as: 'inviter', attributes: ['id', 'email'] },
      ],
    });
  }
  return ProjectInvite.findAll({
    where: { project_id: projectId },
    include: [
      { model: User, as: 'freelancer', attributes: ['id', 'email'] },
      { model: User, as: 'inviter', attributes: ['id', 'email'] },
    ],
  });
};

const createInvite = async (projectId, user, body) => {
  const project = await Project.findByPk(projectId);
  if (!project) throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  assertProjectOwner(project, user);
  if (project.owner_id === body.freelancer_id) {
    throw new ApiError(400, 'Cannot invite yourself', 'INVALID_INVITATION');
  }
  const freelancer = await User.findByPk(body.freelancer_id);
  if (!freelancer) {
    throw new ApiError(404, 'Freelancer not found', 'USER_NOT_FOUND');
  }
  const invite = await ProjectInvite.create({
    project_id: projectId,
    inviter_id: user.id,
    freelancer_id: body.freelancer_id,
    message: body.message,
    status: 'pending',
  });
  return invite;
};

const listBids = async (projectId, user) => {
  const project = await Project.findByPk(projectId);
  if (!project) throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  const where = { project_id: projectId };
  if (project.owner_id !== user.id && user.role !== 'admin') {
    where.bidder_id = user.id;
  }
  return ProjectBid.findAll({
    where,
    include: [{ model: User, as: 'bidder', attributes: ['id', 'email'] }],
    paranoid: false,
  });
};

const createBid = async (projectId, user, body) => {
  const project = await Project.findByPk(projectId, { include: [{ model: ProjectBid, as: 'bids' }] });
  if (!project) throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  if (project.owner_id === user.id) {
    throw new ApiError(400, 'Owners cannot bid on their own projects', 'INVALID_BID');
  }
  if (!['open', 'in_progress'].includes(project.status)) {
    throw new ApiError(400, 'Project is not accepting bids', 'PROJECT_NOT_OPEN');
  }
  const existing = await ProjectBid.findOne({ where: { project_id: projectId, bidder_id: user.id } });
  if (existing) {
    throw new ApiError(409, 'Bid already submitted', 'BID_EXISTS');
  }
  const bid = await ProjectBid.create({
    project_id: projectId,
    bidder_id: user.id,
    amount: body.amount,
    currency: body.currency || project.currency,
    timeline: body.timeline,
    proposal: body.proposal,
    attachments: body.attachments,
    metadata: body.metadata,
  });
  return bid;
};

const updateBid = async (bidId, user, body) => {
  const bid = await ProjectBid.findByPk(bidId, { include: [{ model: Project, as: 'project' }] });
  if (!bid) throw new ApiError(404, 'Bid not found', 'BID_NOT_FOUND');
  const { project } = bid;
  const isOwner = project.owner_id === user.id || user.role === 'admin';
  const isBidder = bid.bidder_id === user.id;
  if (!isOwner && !isBidder) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }

  if (body.status && !isOwner) {
    throw new ApiError(403, 'Only owners can change bid status', 'FORBIDDEN');
  }

  const editableFields = ['amount', 'currency', 'timeline', 'proposal', 'attachments', 'metadata'];
  for (const field of editableFields) {
    if (body[field] !== undefined && isBidder) {
      bid[field] = body[field];
    }
  }

  if (body.status && isOwner) {
    if (!['pending', 'accepted', 'rejected', 'withdrawn'].includes(body.status)) {
      throw new ApiError(400, 'Invalid bid status', 'INVALID_STATUS');
    }
    bid.status = body.status;
    bid.responded_at = new Date();
    if (body.status === 'accepted') {
      project.status = 'in_progress';
      project.awarded_bid_id = bid.id;
      await project.save();
    }
  }

  await bid.save();
  return bid;
};

const deleteBid = async (bidId, user) => {
  const bid = await ProjectBid.findByPk(bidId, { include: [{ model: Project, as: 'project' }] });
  if (!bid) throw new ApiError(404, 'Bid not found', 'BID_NOT_FOUND');
  if (bid.bidder_id !== user.id && bid.project.owner_id !== user.id && user.role !== 'admin') {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }
  await bid.destroy();
  return { success: true };
};

const listMilestones = async (projectId, user) => {
  const project = await Project.findByPk(projectId);
  if (!project) throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  if (project.owner_id !== user.id && user.role !== 'admin') {
    if (!project.awarded_bid_id) {
      throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
    }
    const winningBid = await ProjectBid.findByPk(project.awarded_bid_id);
    if (winningBid?.bidder_id !== user.id) {
      throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
    }
  }
  return ProjectMilestone.findAll({ where: { project_id: projectId }, order: [['sequence', 'ASC']], paranoid: false });
};

const createMilestone = async (projectId, user, body) => {
  const project = await Project.findByPk(projectId, { include: [{ model: ProjectMilestone, as: 'milestones', paranoid: false }] });
  if (!project) throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  assertProjectOwner(project, user);
  const maxSequence = project.milestones?.reduce((max, m) => Math.max(max, m.sequence || 0), 0) || 0;
  const milestone = await ProjectMilestone.create({
    project_id: projectId,
    title: body.title,
    description: body.description,
    amount: body.amount,
    currency: body.currency || project.currency,
    due_date: body.due_date,
    status: body.status || 'pending',
    sequence: body.sequence || maxSequence + 1,
    metadata: body.metadata,
  });
  return milestone;
};

const updateMilestone = async (milestoneId, user, body) => {
  const milestone = await ProjectMilestone.findByPk(milestoneId, { include: [{ model: Project, as: 'project' }] });
  if (!milestone) throw new ApiError(404, 'Milestone not found', 'MILESTONE_NOT_FOUND');
  assertProjectOwner(milestone.project, user);
  const editable = ['title', 'description', 'amount', 'currency', 'due_date', 'status', 'sequence', 'metadata'];
  for (const field of editable) {
    if (body[field] !== undefined) milestone[field] = body[field];
  }
  if (body.status === 'released') {
    milestone.released_at = new Date();
  }
  await milestone.save();
  return milestone;
};

const deleteMilestone = async (milestoneId, user) => {
  const milestone = await ProjectMilestone.findByPk(milestoneId, { include: [{ model: Project, as: 'project' }] });
  if (!milestone) throw new ApiError(404, 'Milestone not found', 'MILESTONE_NOT_FOUND');
  assertProjectOwner(milestone.project, user);
  await milestone.destroy();
  return { success: true };
};

const assertProjectParticipant = async (project, user) => {
  if (project.owner_id === user.id || user.role === 'admin') return;
  if (!project.awarded_bid_id) {
    throw new ApiError(403, 'Project has no awarded freelancer', 'FORBIDDEN');
  }
  const bid = await ProjectBid.findByPk(project.awarded_bid_id);
  if (!bid || bid.bidder_id !== user.id) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }
};

const listDeliverables = async (projectId, user) => {
  const project = await Project.findByPk(projectId);
  if (!project) throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  await assertProjectParticipant(project, user);
  return ProjectDeliverable.findAll({
    where: { project_id: projectId },
    include: [
      { model: User, as: 'submitter', attributes: ['id', 'email'] },
      { model: User, as: 'reviewer', attributes: ['id', 'email'] },
      { model: ProjectMilestone, as: 'milestone' },
    ],
    paranoid: false,
  });
};

const createDeliverable = async (projectId, user, body) => {
  const project = await Project.findByPk(projectId);
  if (!project) throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  await assertProjectParticipant(project, user);
  if (body.milestone_id) {
    const milestone = await ProjectMilestone.findByPk(body.milestone_id);
    if (!milestone || milestone.project_id !== projectId) {
      throw new ApiError(400, 'Invalid milestone', 'INVALID_MILESTONE');
    }
  }
  const deliverable = await ProjectDeliverable.create({
    project_id: projectId,
    milestone_id: body.milestone_id,
    submitter_id: user.id,
    title: body.title,
    description: body.description,
    attachments: body.attachments,
  });
  return deliverable;
};

const updateDeliverable = async (deliverableId, user, body) => {
  const deliverable = await ProjectDeliverable.findByPk(deliverableId, {
    include: [
      { model: Project, as: 'project' },
      { model: User, as: 'reviewer' },
    ],
  });
  if (!deliverable) throw new ApiError(404, 'Deliverable not found', 'DELIVERABLE_NOT_FOUND');
  const project = deliverable.project;
  const isOwner = project.owner_id === user.id || user.role === 'admin';
  const isSubmitter = deliverable.submitter_id === user.id;
  if (!isOwner && !isSubmitter) throw new ApiError(403, 'Forbidden', 'FORBIDDEN');

  if (isSubmitter) {
    const editable = ['title', 'description', 'attachments'];
    for (const field of editable) {
      if (body[field] !== undefined) deliverable[field] = body[field];
    }
  }
  if (isOwner && body.status) {
    if (!['submitted', 'accepted', 'revision_requested'].includes(body.status)) {
      throw new ApiError(400, 'Invalid deliverable status', 'INVALID_STATUS');
    }
    deliverable.status = body.status;
    deliverable.reviewed_at = new Date();
    deliverable.reviewer_id = user.id;
  }
  await deliverable.save();
  return deliverable;
};

const deleteDeliverable = async (deliverableId, user) => {
  const deliverable = await ProjectDeliverable.findByPk(deliverableId, { include: [{ model: Project, as: 'project' }] });
  if (!deliverable) throw new ApiError(404, 'Deliverable not found', 'DELIVERABLE_NOT_FOUND');
  if (deliverable.submitter_id !== user.id && deliverable.project.owner_id !== user.id && user.role !== 'admin') {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }
  await deliverable.destroy();
  return { success: true };
};

const listTimeLogs = async (projectId, user) => {
  const project = await Project.findByPk(projectId);
  if (!project) throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  await assertProjectParticipant(project, user);
  return ProjectTimeLog.findAll({
    where: { project_id: projectId },
    include: [
      { model: User, as: 'user', attributes: ['id', 'email'] },
      { model: User, as: 'approver', attributes: ['id', 'email'] },
    ],
    paranoid: false,
  });
};

const createTimeLog = async (projectId, user, body) => {
  const project = await Project.findByPk(projectId);
  if (!project) throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  if (project.type !== 'hourly') {
    throw new ApiError(400, 'Time logs only available for hourly projects', 'INVALID_PROJECT_TYPE');
  }
  await assertProjectParticipant(project, user);
  const started = dayjs(body.started_at);
  const ended = body.ended_at ? dayjs(body.ended_at) : null;
  if (!started.isValid()) {
    throw new ApiError(400, 'Invalid start time', 'INVALID_TIME');
  }
  let duration = body.duration_minutes;
  if (!duration) {
    if (!ended || !ended.isValid()) {
      throw new ApiError(400, 'Provide duration_minutes or a valid ended_at', 'INVALID_TIME');
    }
    duration = Math.max(1, ended.diff(started, 'minute'));
  }
  const log = await ProjectTimeLog.create({
    project_id: projectId,
    user_id: user.id,
    started_at: started.toDate(),
    ended_at: ended?.toDate() || null,
    duration_minutes: duration,
    notes: body.notes,
    status: 'pending',
  });
  return log;
};

const updateTimeLog = async (timeLogId, user, body) => {
  const log = await ProjectTimeLog.findByPk(timeLogId, { include: [{ model: Project, as: 'project' }] });
  if (!log) throw new ApiError(404, 'Time log not found', 'TIMELOG_NOT_FOUND');
  const project = log.project;
  const isOwner = project.owner_id === user.id || user.role === 'admin';
  const isLogger = log.user_id === user.id;
  if (!isOwner && !isLogger) throw new ApiError(403, 'Forbidden', 'FORBIDDEN');

  if (isLogger) {
    if (body.started_at) log.started_at = new Date(body.started_at);
    if (body.ended_at) log.ended_at = new Date(body.ended_at);
    if (body.duration_minutes) log.duration_minutes = body.duration_minutes;
    if (body.notes !== undefined) log.notes = body.notes;
  }
  if (isOwner && body.status) {
    if (!['pending', 'approved', 'rejected'].includes(body.status)) {
      throw new ApiError(400, 'Invalid status', 'INVALID_STATUS');
    }
    log.status = body.status;
    log.approved_by = user.id;
    log.approved_at = new Date();
  }
  await log.save();
  return log;
};

const deleteTimeLog = async (timeLogId, user) => {
  const log = await ProjectTimeLog.findByPk(timeLogId, { include: [{ model: Project, as: 'project' }] });
  if (!log) throw new ApiError(404, 'Time log not found', 'TIMELOG_NOT_FOUND');
  if (log.user_id !== user.id && log.project.owner_id !== user.id && user.role !== 'admin') {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }
  await log.destroy();
  return { success: true };
};

const listReviews = async (projectId) => {
  return ProjectReview.findAll({
    where: { project_id: projectId },
    include: [
      { model: User, as: 'reviewer', attributes: ['id', 'email'] },
      { model: User, as: 'reviewee', attributes: ['id', 'email'] },
    ],
    paranoid: false,
  });
};

const createReview = async (projectId, user, body) => {
  const project = await Project.findByPk(projectId);
  if (!project) throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  await assertProjectParticipant(project, user);
  if (project.status !== 'completed') {
    throw new ApiError(400, 'Reviews can be submitted only after completion', 'PROJECT_NOT_COMPLETED');
  }
  if (user.id === body.reviewee_id) {
    throw new ApiError(400, 'Cannot review yourself', 'INVALID_REVIEW');
  }
  const reviewee = await User.findByPk(body.reviewee_id);
  if (!reviewee) {
    throw new ApiError(404, 'Reviewee not found', 'USER_NOT_FOUND');
  }
  if (project.owner_id !== body.reviewee_id) {
    if (!project.awarded_bid_id) {
      throw new ApiError(400, 'Project does not have an awarded freelancer', 'INVALID_REVIEWEE');
    }
    const awardedBid = await ProjectBid.findByPk(project.awarded_bid_id);
    if (!awardedBid || awardedBid.bidder_id !== body.reviewee_id) {
      throw new ApiError(400, 'Reviewee must be the awarded freelancer', 'INVALID_REVIEWEE');
    }
  }
  const existing = await ProjectReview.findOne({
    where: { project_id: projectId, reviewer_id: user.id, reviewee_id: body.reviewee_id },
  });
  if (existing) {
    throw new ApiError(409, 'Review already submitted', 'REVIEW_EXISTS');
  }
  const review = await ProjectReview.create({
    project_id: projectId,
    reviewer_id: user.id,
    reviewee_id: body.reviewee_id,
    rating: body.rating,
    comment: body.comment,
    private_note: body.private_note,
    metadata: body.metadata,
  });
  return review;
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
};
