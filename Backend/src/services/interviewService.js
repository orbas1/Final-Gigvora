const { Op } = require('sequelize');
const {
  Job,
  JobApplication,
  Interview,
  InterviewFeedback,
  User,
  sequelize,
} = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { buildPagination, encodeCursor } = require('../utils/pagination');

const canManageJob = (job, user) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return job.posted_by === user.id || job.company_id === user.id || (user.org_id && user.org_id === job.company_id);
};

const loadJob = async (jobId, { paranoid = true } = {}) => {
  const job = await Job.findByPk(jobId, { paranoid });
  if (!job) {
    throw new ApiError(404, 'Job not found', 'JOB_NOT_FOUND');
  }
  return job;
};

const loadApplication = async (applicationId) => {
  const application = await JobApplication.findByPk(applicationId);
  if (!application) {
    throw new ApiError(404, 'Application not found', 'APPLICATION_NOT_FOUND');
  }
  return application;
};

const ensureInterviewAccess = async (interview, user, { includeDeleted = false } = {}) => {
  const job = interview.job || (await loadJob(interview.job_id, { paranoid: !includeDeleted }));
  if (canManageJob(job, user)) return;
  if (user?.role === 'admin') return;
  if (interview.application_id) {
    const application = interview.application || (await loadApplication(interview.application_id));
    if (application.candidate_id === user?.id) return;
  }
  throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
};

const parsePanel = (panel) => {
  if (!panel) return null;
  if (Array.isArray(panel)) return panel;
  if (typeof panel === 'string') {
    try {
      const parsed = JSON.parse(panel);
      return Array.isArray(parsed) ? parsed : null;
    } catch (error) {
      return null;
    }
  }
  return null;
};

const listInterviews = async (user, query) => {
  const includeDeleted = String(query.include).toLowerCase() === 'deleted' && user?.role === 'admin';
  const pagination = buildPagination(query, ['scheduled_at', 'created_at']);
  const baseWhere = {};
  const include = [];

  if (!query.job_id && !query.application_id && user?.role !== 'admin') {
    throw new ApiError(400, 'job_id or application_id is required', 'FILTER_REQUIRED');
  }

  if (query.job_id) {
    const job = await loadJob(query.job_id, { paranoid: !includeDeleted });
    if (!canManageJob(job, user) && user?.role !== 'admin') {
      throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
    }
    baseWhere.job_id = query.job_id;
  }

  if (query.application_id) {
    const application = await loadApplication(query.application_id);
    if (
      !canManageJob(await loadJob(application.job_id), user) &&
      application.candidate_id !== user?.id &&
      user?.role !== 'admin'
    ) {
      throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
    }
    baseWhere.application_id = query.application_id;
  }

  if (query.status) baseWhere.status = query.status;
  if (query.from || query.to) {
    baseWhere.scheduled_at = {};
    if (query.from) baseWhere.scheduled_at[Op.gte] = new Date(query.from);
    if (query.to) baseWhere.scheduled_at[Op.lte] = new Date(query.to);
  }

  const expansions = new Set(
    (query.expand || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );

  if (expansions.has('job')) include.push({ model: Job, as: 'job' });
  if (expansions.has('application')) include.push({ model: JobApplication, as: 'application' });
  if (expansions.has('feedback')) include.push({ model: InterviewFeedback, as: 'feedback' });

  const whereClause = { ...baseWhere };
  if (pagination.cursorValue !== undefined) {
    whereClause[pagination.sortField] = { [pagination.cursorOperator]: pagination.cursorValue };
  }

  const interviews = await Interview.findAll({
    where: whereClause,
    include,
    paranoid: !includeDeleted,
    limit: pagination.limit + 1,
    order: pagination.order,
  });

  const hasNext = interviews.length > pagination.limit;
  const items = hasNext ? interviews.slice(0, pagination.limit) : interviews;
  const data = items.map((interview) => interview.toJSON());
  const nextCursor = hasNext ? encodeCursor(items[items.length - 1][pagination.sortField]) : null;

  let analytics;
  if (String(query.analytics).toLowerCase() === 'true') {
    const statusCounts = await Interview.findAll({
      where: baseWhere,
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'count']],
      group: ['status'],
    });
    analytics = statusCounts.map((row) => ({ status: row.status, count: Number(row.get('count')) }));
  }

  return { data, next_cursor: nextCursor, analytics };
};

const createInterview = async (user, payload) => {
  const job = await loadJob(payload.job_id);
  if (!canManageJob(job, user)) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }
  const application = await loadApplication(payload.application_id);
  if (application.job_id !== job.id) {
    throw new ApiError(400, 'Application does not belong to job', 'INVALID_RELATION');
  }

  const interview = await Interview.create({
    job_id: job.id,
    application_id: application.id,
    scheduled_at: new Date(payload.scheduled_at),
    duration_minutes: payload.duration_minutes,
    meeting_url: payload.meeting_url,
    location: payload.location,
    status: payload.status || 'scheduled',
    panel: parsePanel(payload.panel),
    notes: payload.notes,
    recording_url: payload.recording_url,
  });

  return interview.toJSON();
};

const getInterview = async (id, user, { includeDeleted = false, expand = [] } = {}) => {
  const include = [];
  const expansions = new Set(expand);
  if (expansions.has('job')) include.push({ model: Job, as: 'job' });
  if (expansions.has('application')) include.push({ model: JobApplication, as: 'application' });
  if (expansions.has('feedback')) include.push({ model: InterviewFeedback, as: 'feedback' });

  const interview = await Interview.findByPk(id, { include, paranoid: !includeDeleted });
  if (!interview) {
    throw new ApiError(404, 'Interview not found', 'INTERVIEW_NOT_FOUND');
  }
  await ensureInterviewAccess(interview, user, { includeDeleted });
  return interview.toJSON();
};

const updateInterview = async (id, user, payload) => {
  const interview = await Interview.findByPk(id);
  if (!interview) {
    throw new ApiError(404, 'Interview not found', 'INTERVIEW_NOT_FOUND');
  }
  const job = await loadJob(interview.job_id);
  if (!canManageJob(job, user)) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }

  await interview.update({
    scheduled_at: payload.scheduled_at ? new Date(payload.scheduled_at) : interview.scheduled_at,
    duration_minutes: payload.duration_minutes ?? interview.duration_minutes,
    meeting_url: payload.meeting_url ?? interview.meeting_url,
    location: payload.location ?? interview.location,
    status: payload.status ?? interview.status,
    panel: payload.panel ? parsePanel(payload.panel) : interview.panel,
    notes: payload.notes ?? interview.notes,
    recording_url: payload.recording_url ?? interview.recording_url,
  });

  return interview.toJSON();
};

const deleteInterview = async (id, user) => {
  const interview = await Interview.findByPk(id);
  if (!interview) {
    throw new ApiError(404, 'Interview not found', 'INTERVIEW_NOT_FOUND');
  }
  const job = await loadJob(interview.job_id);
  if (!canManageJob(job, user)) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }
  await interview.destroy();
  return { success: true };
};

const submitFeedback = async (id, user, payload) => {
  const interview = await Interview.findByPk(id, { include: [{ model: Job, as: 'job' }] });
  if (!interview) {
    throw new ApiError(404, 'Interview not found', 'INTERVIEW_NOT_FOUND');
  }
  const job = interview.job || (await loadJob(interview.job_id));
  if (!canManageJob(job, user) && user?.role !== 'admin') {
    const application = await loadApplication(interview.application_id);
    if (application.candidate_id !== user?.id) {
      throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
    }
  }

  const reviewerId = payload.reviewer_id || user?.id;
  if (!reviewerId) {
    throw new ApiError(400, 'Reviewer is required', 'REVIEWER_REQUIRED');
  }

  const [feedback] = await InterviewFeedback.findOrCreate({
    where: { interview_id: interview.id, reviewer_id: reviewerId },
    defaults: {
      rating: payload.rating,
      highlights: payload.highlights,
      concerns: payload.concerns,
      recommendation: payload.recommendation,
      submitted_at: payload.submitted_at || new Date(),
    },
  });

  if (!feedback.isNewRecord) {
    await feedback.update({
      rating: payload.rating ?? feedback.rating,
      highlights: payload.highlights ?? feedback.highlights,
      concerns: payload.concerns ?? feedback.concerns,
      recommendation: payload.recommendation ?? feedback.recommendation,
      submitted_at: payload.submitted_at || feedback.submitted_at || new Date(),
    });
  }

  return feedback.toJSON();
};

module.exports = {
  listInterviews,
  createInterview,
  getInterview,
  updateInterview,
  deleteInterview,
  submitFeedback,
};
