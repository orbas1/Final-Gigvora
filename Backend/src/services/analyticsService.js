const dayjs = require('dayjs');
const { Op } = require('sequelize');
const { Job, JobStage, JobApplication, JobMetric, Interview, sequelize } = require('../models');
const { ApiError } = require('../middleware/errorHandler');

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

const jobAnalytics = async (jobId, user) => {
  const job = await loadJob(jobId, { paranoid: false });
  if (!canManageJob(job, user)) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }

  const metrics = await JobMetric.findAll({
    where: { job_id: jobId },
    order: [['metric_date', 'DESC']],
    limit: 30,
  });

  const daily = metrics
    .map((metric) => ({
      date: dayjs(metric.metric_date).format('YYYY-MM-DD'),
      views: metric.views_count,
      applications: metric.applications_count,
    }))
    .reverse();

  const conversion = job.views_count ? (job.applications_count / job.views_count) * 100 : 0;

  return {
    job_id: job.id,
    title: job.title,
    views: job.views_count,
    applications: job.applications_count,
    hires: job.hires_count,
    conversion_rate: Number(conversion.toFixed(2)),
    daily,
  };
};

const atsFunnel = async (jobId, user) => {
  const job = await loadJob(jobId, { paranoid: false });
  if (!canManageJob(job, user)) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }

  const stages = await JobStage.findAll({
    where: { job_id: jobId },
    order: [['order_index', 'ASC']],
  });
  const stageCounts = await JobApplication.findAll({
    where: { job_id: jobId },
    attributes: ['stage_id', [sequelize.fn('COUNT', sequelize.col('stage_id')), 'count']],
    group: ['stage_id'],
  });
  const stageMap = new Map(stageCounts.map((row) => [row.stage_id, Number(row.get('count'))]));

  return {
    job_id: jobId,
    stages: stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      slug: stage.slug,
      order_index: stage.order_index,
      count: stageMap.get(stage.id) || 0,
    })),
  };
};

const interviewLoad = async (user, { from, to }) => {
  const fromDate = from ? dayjs(from).startOf('day') : dayjs().subtract(30, 'day').startOf('day');
  const toDate = to ? dayjs(to).endOf('day') : dayjs().endOf('day');

  const where = {
    scheduled_at: {
      [Op.between]: [fromDate.toDate(), toDate.toDate()],
    },
  };

  if (user?.role !== 'admin') {
    const jobs = await Job.findAll({
      where: {
        [Op.or]: [{ posted_by: user?.id }, { company_id: user?.id }, { company_id: user?.org_id }],
      },
      attributes: ['id'],
    });
    const jobIds = jobs.map((job) => job.id);
    if (!jobIds.length) {
      return {
        range: { from: fromDate.toISOString(), to: toDate.toISOString() },
        totals: { scheduled: 0, completed: 0, cancelled: 0 },
        daily: [],
      };
    }
    where.job_id = { [Op.in]: jobIds };
  }

  const interviews = await Interview.findAll({
    where,
    attributes: ['scheduled_at', 'status', 'panel'],
    order: [['scheduled_at', 'ASC']],
  });

  const dailyMap = new Map();
  const totals = { scheduled: 0, completed: 0, cancelled: 0 };

  interviews.forEach((interview) => {
    const dayKey = dayjs(interview.scheduled_at).format('YYYY-MM-DD');
    const entry = dailyMap.get(dayKey) || { date: dayKey, scheduled: 0, completed: 0, cancelled: 0, average_panel: 0, interviews: 0 };
    entry.interviews += 1;
    entry[interview.status] = (entry[interview.status] || 0) + 1;
    const panelSize = Array.isArray(interview.panel) ? interview.panel.length : 0;
    entry.average_panel = ((entry.average_panel * (entry.interviews - 1)) + panelSize) / entry.interviews;
    dailyMap.set(dayKey, entry);

    totals[interview.status] = (totals[interview.status] || 0) + 1;
  });

  const daily = Array.from(dailyMap.values()).map((entry) => ({
    date: entry.date,
    scheduled: entry.scheduled || 0,
    completed: entry.completed || 0,
    cancelled: entry.cancelled || 0,
    average_panel: Number(entry.average_panel.toFixed(2)),
  }));

  return {
    range: { from: fromDate.toISOString(), to: toDate.toISOString() },
    totals,
    daily,
  };
};

module.exports = {
  jobAnalytics,
  atsFunnel,
  interviewLoad,
};
