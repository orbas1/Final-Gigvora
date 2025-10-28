const { Op, fn, col } = require('sequelize');
const {
  Job,
  JobStage,
  JobApplication,
  ApplicationTag,
  Scorecard,
  User,
  sequelize,
} = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { buildPagination, encodeCursor } = require('../utils/pagination');
const { incrementJobCounters } = require('./jobService');

const ALLOWED_STATUS = new Set(['applied', 'screening', 'interviewing', 'offered', 'hired', 'rejected', 'withdrawn']);

const canManageJob = (job, user) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return job.posted_by === user.id || job.company_id === user.id || (user.org_id && user.org_id === job.company_id);
};

const canViewApplication = (application, job, user) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (application.candidate_id && application.candidate_id === user.id) return true;
  return canManageJob(job, user);
};

const loadJob = async (jobId, { paranoid = true } = {}) => {
  const job = await Job.findByPk(jobId, { paranoid });
  if (!job) {
    throw new ApiError(404, 'Job not found', 'JOB_NOT_FOUND');
  }
  return job;
};

const loadApplication = async (id, { paranoid = true, include = [] } = {}) => {
  const application = await JobApplication.findByPk(id, { include, paranoid });
  if (!application) {
    throw new ApiError(404, 'Application not found', 'APPLICATION_NOT_FOUND');
  }
  return application;
};

const normalizeTags = (tags = []) =>
  [...new Set(tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))];

const updateTagSnapshot = async (applicationId, transaction) => {
  const tags = await ApplicationTag.findAll({ where: { application_id: applicationId }, transaction });
  await JobApplication.update(
    { tags_snapshot: tags.map((record) => record.tag) },
    { where: { id: applicationId }, transaction }
  );
};

const fetchDefaultStage = async (jobId, transaction) => {
  const stage = await JobStage.findOne({
    where: { job_id: jobId },
    order: [['order_index', 'ASC']],
    transaction,
  });
  if (!stage) {
    throw new ApiError(409, 'Job pipeline is not configured', 'PIPELINE_MISSING');
  }
  return stage;
};

const applyStage = async (jobId, stageId, transaction) => {
  if (!stageId) return fetchDefaultStage(jobId, transaction);
  const stage = await JobStage.findOne({ where: { id: stageId, job_id: jobId }, transaction });
  if (!stage) {
    throw new ApiError(404, 'Stage not found for job', 'STAGE_NOT_FOUND');
  }
  return stage;
};

const mapStageToStatus = (stage) => {
  if (!stage) return undefined;
  const slug = (stage.slug || stage.name || '').toLowerCase();
  if (slug.includes('hire')) return 'hired';
  if (slug.includes('offer')) return 'offered';
  if (slug.includes('interview')) return 'interviewing';
  if (slug.includes('screen')) return 'screening';
  return undefined;
};

const formatApplication = (application) => {
  const plain = application.toJSON();
  if (plain.tagAssignments) {
    plain.tags = plain.tagAssignments.map((tag) => tag.tag);
    delete plain.tagAssignments;
  }
  return plain;
};

const listJobApplications = async (jobId, user, query) => {
  const includeDeleted = String(query.include).toLowerCase() === 'deleted' && user?.role === 'admin';
  const job = await loadJob(jobId, { paranoid: !includeDeleted });
  if (!canManageJob(job, user)) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }

  const pagination = buildPagination(query, ['created_at', 'updated_at']);
  const whereClause = { job_id: jobId };
  if (query.stage) whereClause.stage_id = query.stage;
  if (query.status) whereClause.status = query.status;

  const include = [];
  const expansions = new Set(
    (query.expand || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );
  if (expansions.has('candidate')) {
    include.push({ model: User, as: 'candidate', attributes: ['id', 'email', 'role'] });
  }
  if (expansions.has('stage')) {
    include.push({ model: JobStage, as: 'stage' });
  }
  if (expansions.has('tags')) {
    include.push({ model: ApplicationTag, as: 'tagAssignments', attributes: ['tag'] });
  }

  if (pagination.cursorValue !== undefined) {
    whereClause[pagination.sortField] = { [pagination.cursorOperator]: pagination.cursorValue };
  }

  const applications = await JobApplication.findAll({
    where: whereClause,
    include,
    paranoid: !includeDeleted,
    limit: pagination.limit + 1,
    order: pagination.order,
  });

  const hasNext = applications.length > pagination.limit;
  const items = hasNext ? applications.slice(0, pagination.limit) : applications;
  const data = items.map(formatApplication);
  const nextCursor = hasNext ? encodeCursor(items[items.length - 1][pagination.sortField]) : null;

  let analytics;
  if (String(query.analytics).toLowerCase() === 'true') {
    const statusCounts = await JobApplication.findAll({
      where: { job_id: jobId },
      attributes: ['status', [fn('COUNT', col('status')), 'count']],
      group: ['status'],
    });
    const stageCounts = await JobApplication.findAll({
      where: { job_id: jobId },
      attributes: ['stage_id', [fn('COUNT', col('stage_id')), 'count']],
      group: ['stage_id'],
    });
    analytics = {
      by_status: statusCounts.map((row) => ({ status: row.status, count: Number(row.get('count')) })),
      by_stage: stageCounts.map((row) => ({ stage_id: row.stage_id, count: Number(row.get('count')) })),
    };
  }

  return {
    data,
    next_cursor: nextCursor,
    analytics,
  };
};

const createJobApplication = async (jobId, user, payload) => {
  const transaction = await sequelize.transaction();
  try {
    const job = await loadJob(jobId, { paranoid: true });
    if (!job || job.status === 'archived') {
      throw new ApiError(409, 'Job is not accepting applications', 'JOB_NOT_OPEN');
    }

    const candidateId = payload.candidate_id && canManageJob(job, user) ? payload.candidate_id : user?.id;
    if (!candidateId) {
      throw new ApiError(400, 'Candidate information is required', 'CANDIDATE_REQUIRED');
    }

    const stage = await applyStage(jobId, payload.stage_id, transaction);
    const inferredStatus = mapStageToStatus(stage) || 'applied';

    const application = await JobApplication.create(
      {
        job_id: jobId,
        stage_id: stage.id,
        candidate_id: candidateId,
        resume_url: payload.resume_url,
        parsed_fields: payload.parsed_fields,
        status: inferredStatus,
        notes: payload.notes,
        rating: payload.rating,
        email: payload.email,
        phone: payload.phone,
      },
      { transaction }
    );

    if (payload.tags) {
      const tags = normalizeTags(payload.tags);
      if (tags.length) {
        await ApplicationTag.bulkCreate(
          tags.map((tag) => ({ application_id: application.id, tag })),
          { transaction }
        );
        await updateTagSnapshot(application.id, transaction);
      }
    }

    await transaction.commit();

    await incrementJobCounters(jobId, { applications: 1 });

    const created = await JobApplication.findByPk(application.id, {
      include: [
        { model: JobStage, as: 'stage' },
        { model: ApplicationTag, as: 'tagAssignments', attributes: ['tag'] },
      ],
    });

    return formatApplication(created);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const getApplication = async (id, user, { includeDeleted = false, expand = [] } = {}) => {
  const include = [];
  const expansions = new Set(expand);
  if (expansions.has('job')) include.push({ model: Job, as: 'job' });
  if (expansions.has('stage')) include.push({ model: JobStage, as: 'stage' });
  if (expansions.has('candidate')) include.push({ model: User, as: 'candidate', attributes: ['id', 'email', 'role'] });
  if (expansions.has('tags')) include.push({ model: ApplicationTag, as: 'tagAssignments', attributes: ['tag'] });
  if (expansions.has('scorecards')) include.push({ model: Scorecard, as: 'scorecards' });

  const application = await loadApplication(id, { include, paranoid: !includeDeleted });
  const job = application.job || (await loadJob(application.job_id, { paranoid: !includeDeleted }));

  if (!canViewApplication(application, job, user)) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }

  return formatApplication(application);
};

const updateApplication = async (id, user, payload) => {
  const application = await JobApplication.findByPk(id, {
    include: [
      { model: JobStage, as: 'stage' },
      { model: ApplicationTag, as: 'tagAssignments', attributes: ['tag'] },
    ],
  });
  if (!application) {
    throw new ApiError(404, 'Application not found', 'APPLICATION_NOT_FOUND');
  }
  const job = await loadJob(application.job_id, { paranoid: true });
  const manage = canManageJob(job, user);
  const isCandidate = user && application.candidate_id === user.id;
  if (!manage && !isCandidate && user?.role !== 'admin') {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }

  const transaction = await sequelize.transaction();
  try {
    const wasHired = application.status === 'hired';
    const updates = {};
    if (payload.notes !== undefined) updates.notes = payload.notes;
    if (payload.parsed_fields !== undefined) updates.parsed_fields = payload.parsed_fields;
    if (payload.resume_url !== undefined) updates.resume_url = payload.resume_url;
    if (payload.email !== undefined && manage) updates.email = payload.email;
    if (payload.phone !== undefined && manage) updates.phone = payload.phone;
    if (payload.rating !== undefined && manage) updates.rating = payload.rating;

    if (manage) {
      if (payload.stage_id) {
        const stage = await applyStage(job.id, payload.stage_id, transaction);
        updates.stage_id = stage.id;
        const mappedStatus = mapStageToStatus(stage);
        if (mappedStatus) {
          updates.status = mappedStatus;
          if (mappedStatus === 'hired') {
            updates.hired_at = application.hired_at || new Date();
          }
        }
      }
      if (payload.status && ALLOWED_STATUS.has(payload.status)) {
        updates.status = payload.status;
        if (payload.status === 'hired') {
          updates.hired_at = application.hired_at || new Date();
        }
        if (payload.status === 'withdrawn') {
          updates.withdrew_at = new Date();
        }
      }
    } else if (payload.status && payload.status !== 'withdrawn') {
      throw new ApiError(403, 'Only recruiters can change status', 'FORBIDDEN');
    }

    if (payload.status === 'withdrawn' && isCandidate) {
      updates.status = 'withdrawn';
      updates.withdrew_at = new Date();
    }

    await application.update(updates, { transaction });

    if (payload.tags && manage) {
      await ApplicationTag.destroy({ where: { application_id: id }, transaction });
      const tags = normalizeTags(payload.tags);
      if (tags.length) {
        await ApplicationTag.bulkCreate(
          tags.map((tag) => ({ application_id: id, tag })),
          { transaction }
        );
      }
      await updateTagSnapshot(id, transaction);
    }

    await transaction.commit();

    if (!wasHired && application.status === 'hired') {
      await incrementJobCounters(application.job_id, { hires: 1 });
    }

    const refreshed = await JobApplication.findByPk(id, {
      include: [
        { model: JobStage, as: 'stage' },
        { model: ApplicationTag, as: 'tagAssignments', attributes: ['tag'] },
      ],
    });
    return formatApplication(refreshed);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const deleteApplication = async (id, user) => {
  const application = await JobApplication.findByPk(id);
  if (!application) {
    throw new ApiError(404, 'Application not found', 'APPLICATION_NOT_FOUND');
  }
  const job = await loadJob(application.job_id, { paranoid: true });
  const manage = canManageJob(job, user);
  const isCandidate = user && application.candidate_id === user.id;
  if (!manage && !isCandidate) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }

  if (isCandidate && application.status !== 'withdrawn') {
    await application.update({ status: 'withdrawn', withdrew_at: new Date() });
  }

  await application.destroy();
  return { success: true };
};

const moveApplication = async (id, user, stageId) => {
  const application = await JobApplication.findByPk(id);
  if (!application) {
    throw new ApiError(404, 'Application not found', 'APPLICATION_NOT_FOUND');
  }
  const job = await loadJob(application.job_id, { paranoid: true });
  if (!canManageJob(job, user)) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }
  const stage = await applyStage(job.id, stageId);

  const updates = { stage_id: stage.id };
  const mappedStatus = mapStageToStatus(stage);
  if (mappedStatus) {
    updates.status = mappedStatus;
    if (mappedStatus === 'hired' && !application.hired_at) {
      updates.hired_at = new Date();
      await incrementJobCounters(job.id, { hires: 1 });
    }
  }

  await application.update(updates);
  return { success: true, stage_id: stage.id, status: updates.status ?? application.status };
};

const addTags = async (id, user, tags) => {
  const application = await JobApplication.findByPk(id);
  if (!application) {
    throw new ApiError(404, 'Application not found', 'APPLICATION_NOT_FOUND');
  }
  const job = await loadJob(application.job_id, { paranoid: true });
  if (!canManageJob(job, user)) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }
  const normalized = normalizeTags(tags);
  const transaction = await sequelize.transaction();
  try {
    if (normalized.length) {
      const existing = await ApplicationTag.findAll({
        where: { application_id: id, tag: { [Op.in]: normalized } },
        transaction,
      });
      const existingTags = new Set(existing.map((record) => record.tag));
      const toInsert = normalized.filter((tag) => !existingTags.has(tag));
      if (toInsert.length) {
        await ApplicationTag.bulkCreate(
          toInsert.map((tag) => ({ application_id: id, tag })),
          { transaction }
        );
      }
    }
    await updateTagSnapshot(id, transaction);
    await transaction.commit();
    return { success: true };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const removeTags = async (id, user, tags) => {
  const application = await JobApplication.findByPk(id);
  if (!application) {
    throw new ApiError(404, 'Application not found', 'APPLICATION_NOT_FOUND');
  }
  const job = await loadJob(application.job_id, { paranoid: true });
  if (!canManageJob(job, user)) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }
  const normalized = normalizeTags(tags);
  const transaction = await sequelize.transaction();
  try {
    if (normalized.length) {
      await ApplicationTag.destroy({ where: { application_id: id, tag: { [Op.in]: normalized } }, transaction });
    }
    await updateTagSnapshot(id, transaction);
    await transaction.commit();
    return { success: true };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const listScorecards = async (applicationId, user) => {
  const application = await JobApplication.findByPk(applicationId, {
    include: [{ model: Job, as: 'job' }],
  });
  if (!application) {
    throw new ApiError(404, 'Application not found', 'APPLICATION_NOT_FOUND');
  }
  if (!canViewApplication(application, application.job, user)) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }

  const scorecards = await Scorecard.findAll({
    where: { application_id: applicationId },
    include: [{ model: User, as: 'reviewer', attributes: ['id', 'email', 'role'] }],
  });
  return scorecards.map((scorecard) => scorecard.toJSON());
};

const createScorecard = async (applicationId, user, payload) => {
  const application = await JobApplication.findByPk(applicationId, {
    include: [{ model: Job, as: 'job' }],
  });
  if (!application) {
    throw new ApiError(404, 'Application not found', 'APPLICATION_NOT_FOUND');
  }
  const manage = canManageJob(application.job, user);
  if (!manage && (!user || user.id !== payload.reviewer_id)) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }
  const reviewerId = payload.reviewer_id || user.id;
  if (!reviewerId) {
    throw new ApiError(400, 'Reviewer is required', 'REVIEWER_REQUIRED');
  }

  const scorecard = await Scorecard.create({
    application_id: applicationId,
    reviewer_id: reviewerId,
    overall_rating: payload.overall_rating,
    recommendation: payload.recommendation,
    competencies: payload.competencies,
    summary: payload.summary,
    submitted_at: payload.submitted_at || new Date(),
  });

  return scorecard.toJSON();
};

const updateScorecard = async (scorecardId, user, payload) => {
  const scorecard = await Scorecard.findByPk(scorecardId, {
    include: [{ model: JobApplication, as: 'application', include: [{ model: Job, as: 'job' }] }],
  });
  if (!scorecard) {
    throw new ApiError(404, 'Scorecard not found', 'SCORECARD_NOT_FOUND');
  }
  const manage = canManageJob(scorecard.application.job, user);
  if (!manage && scorecard.reviewer_id !== user?.id) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }

  await scorecard.update({
    overall_rating: payload.overall_rating ?? scorecard.overall_rating,
    recommendation: payload.recommendation ?? scorecard.recommendation,
    competencies: payload.competencies ?? scorecard.competencies,
    summary: payload.summary ?? scorecard.summary,
    submitted_at: payload.submitted_at ?? scorecard.submitted_at ?? new Date(),
  });

  return scorecard.toJSON();
};

const deleteScorecard = async (scorecardId, user) => {
  const scorecard = await Scorecard.findByPk(scorecardId, {
    include: [{ model: JobApplication, as: 'application', include: [{ model: Job, as: 'job' }] }],
  });
  if (!scorecard) {
    throw new ApiError(404, 'Scorecard not found', 'SCORECARD_NOT_FOUND');
  }
  if (!canManageJob(scorecard.application.job, user) && scorecard.reviewer_id !== user?.id) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }
  await scorecard.destroy();
  return { success: true };
};

module.exports = {
  listJobApplications,
  createJobApplication,
  getApplication,
  updateApplication,
  deleteApplication,
  moveApplication,
  addTags,
  removeTags,
  listScorecards,
  createScorecard,
  updateScorecard,
  deleteScorecard,
};
