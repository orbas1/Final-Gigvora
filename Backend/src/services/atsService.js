const { Op } = require('sequelize');
const { Job, JobStage, JobApplication, sequelize } = require('../models');
const { ApiError } = require('../middleware/errorHandler');

const canManageJob = (job, user) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return job.posted_by === user.id || job.company_id === user.id || (user.org_id && user.org_id === job.company_id);
};

const loadJob = async (jobId) => {
  const job = await Job.findByPk(jobId);
  if (!job) {
    throw new ApiError(404, 'Job not found', 'JOB_NOT_FOUND');
  }
  return job;
};

const reorderStages = async (jobId, transaction) => {
  const stages = await JobStage.findAll({
    where: { job_id: jobId },
    order: [['order_index', 'ASC']],
    transaction,
    paranoid: false,
  });
  const activeStages = stages.filter((stage) => !stage.deleted_at);
  await Promise.all(
    activeStages.map((stage, index) => {
      const nextOrder = index + 1;
      if (stage.order_index !== nextOrder) {
        stage.order_index = nextOrder;
        return stage.save({ transaction, hooks: false, silent: true });
      }
      return null;
    })
  );
};

const listStages = async (jobId, user, query) => {
  const includeDeleted = String(query.include).toLowerCase() === 'deleted' && user?.role === 'admin';
  const job = await loadJob(jobId);
  if (!canManageJob(job, user) && user?.role !== 'admin') {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }
  const stages = await JobStage.findAll({
    where: { job_id: jobId },
    order: [['order_index', 'ASC']],
    paranoid: !includeDeleted,
  });
  return stages.map((stage) => stage.toJSON());
};

const createStage = async (jobId, user, payload) => {
  const job = await loadJob(jobId);
  if (!canManageJob(job, user)) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }

  const transaction = await sequelize.transaction();
  try {
    const maxStage = await JobStage.max('order_index', { where: { job_id: jobId }, transaction });
    const orderIndex = payload.order_index || (Number(maxStage) || 0) + 1;

    const stage = await JobStage.create(
      {
        job_id: jobId,
        name: payload.name,
        order_index: orderIndex,
        is_default: payload.is_default || false,
        auto_advance_days: payload.auto_advance_days ?? null,
      },
      { transaction }
    );

    if (payload.order_index) {
      await reorderStages(jobId, transaction);
    }

    if (payload.is_default) {
      await JobStage.update({ is_default: false }, { where: { job_id: jobId, id: { [Op.ne]: stage.id } }, transaction });
    }

    await transaction.commit();
    return stage.toJSON();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const updateStage = async (jobId, stageId, user, payload) => {
  const job = await loadJob(jobId);
  if (!canManageJob(job, user)) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }
  const stage = await JobStage.findOne({ where: { id: stageId, job_id: jobId }, paranoid: false });
  if (!stage) {
    throw new ApiError(404, 'Stage not found', 'STAGE_NOT_FOUND');
  }

  const transaction = await sequelize.transaction();
  try {
    await stage.update(
      {
        name: payload.name ?? stage.name,
        order_index: payload.order_index ?? stage.order_index,
        is_default: payload.is_default ?? stage.is_default,
        auto_advance_days: payload.auto_advance_days ?? stage.auto_advance_days,
      },
      { transaction }
    );

    await reorderStages(jobId, transaction);

    if (payload.is_default) {
      await JobStage.update(
        { is_default: false },
        { where: { job_id: jobId, id: { [Op.ne]: stage.id } }, transaction }
      );
    }

    await transaction.commit();
    return stage.toJSON();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const deleteStage = async (jobId, stageId, user) => {
  const job = await loadJob(jobId);
  if (!canManageJob(job, user)) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }
  const stage = await JobStage.findOne({ where: { id: stageId, job_id: jobId } });
  if (!stage) {
    throw new ApiError(404, 'Stage not found', 'STAGE_NOT_FOUND');
  }

  const transaction = await sequelize.transaction();
  try {
    await stage.destroy({ transaction });

    const fallback = await JobStage.findOne({
      where: { job_id: jobId },
      order: [['order_index', 'ASC']],
      transaction,
    });
    if (!fallback) {
      throw new ApiError(409, 'Cannot delete the last stage in the pipeline', 'PIPELINE_MINIMUM');
    }

    await JobApplication.update(
      { stage_id: fallback.id },
      { where: { job_id: jobId, stage_id: stageId }, transaction }
    );

    if (stage.is_default && fallback) {
      await JobStage.update({ is_default: false }, { where: { job_id: jobId }, transaction });
      await fallback.update({ is_default: true }, { transaction });
    }

    await reorderStages(jobId, transaction);
    await transaction.commit();
    return { success: true, reassigned_to: fallback.id };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

module.exports = {
  listStages,
  createStage,
  updateStage,
  deleteStage,
};
