const { Op } = require('sequelize');
const { Project, ProjectMilestone, GigOrder, User, sequelize } = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { aggregateByPeriod } = require('../utils/analytics');

const normalizeDate = (value) => (value ? new Date(value) : undefined);

const projectRevenue = async ({ from, to, group_by: groupBy = 'day' }) => {
  if (!['day', 'org', 'user'].includes(groupBy)) {
    throw new ApiError(400, 'Invalid group_by value', 'INVALID_GROUP_BY');
  }

  if (groupBy === 'day') {
    const data = await aggregateByPeriod(ProjectMilestone, 'released_at', {
      granularity: 'day',
      from,
      to,
      extraWhere: [`status = 'released'`],
      replacements: {},
    });
    const totals = await ProjectMilestone.sum('amount', {
      where: {
        status: 'released',
        ...(from ? { released_at: { [Op.gte]: normalizeDate(from) } } : {}),
        ...(to ? { released_at: { ...(from ? { [Op.gte]: normalizeDate(from) } : {}), [Op.lte]: normalizeDate(to) } } : {}),
      },
    });
    return { buckets: data, total_revenue: Number(totals || 0) };
  }

  const where = { status: 'released' };
  if (from || to) {
    where.released_at = {};
    if (from) where.released_at[Op.gte] = normalizeDate(from);
    if (to) where.released_at[Op.lte] = normalizeDate(to);
  }

  if (groupBy === 'org') {
    const rows = await ProjectMilestone.findAll({
      attributes: [
        [sequelize.col('project.owner.org_id'), 'org_id'],
        [sequelize.fn('SUM', sequelize.col('ProjectMilestone.amount')), 'revenue'],
      ],
      include: [
        {
          model: Project,
          as: 'project',
          attributes: [],
          include: [{ model: User, as: 'owner', attributes: [] }],
        },
      ],
      where,
      group: ['project.owner.org_id'],
      raw: true,
    });
    return {
      buckets: rows.map((row) => ({ key: row.org_id, revenue: Number(row.revenue || 0) })),
      total_revenue: rows.reduce((acc, row) => acc + Number(row.revenue || 0), 0),
    };
  }

  const rows = await ProjectMilestone.findAll({
    attributes: [
      [sequelize.col('project.owner_id'), 'user_id'],
      [sequelize.fn('SUM', sequelize.col('ProjectMilestone.amount')), 'revenue'],
    ],
    include: [{ model: Project, as: 'project', attributes: [] }],
    where,
    group: ['project.owner_id'],
    raw: true,
  });
  return {
    buckets: rows.map((row) => ({ key: row.user_id, revenue: Number(row.revenue || 0) })),
    total_revenue: rows.reduce((acc, row) => acc + Number(row.revenue || 0), 0),
  };
};

const gigSales = async ({ from, to }) => {
  const where = {};
  if (from || to) {
    where.placed_at = {};
    if (from) where.placed_at[Op.gte] = normalizeDate(from);
    if (to) where.placed_at[Op.lte] = normalizeDate(to);
  }
  const [orders, completed, revenue] = await Promise.all([
    GigOrder.count({ where }),
    GigOrder.count({ where: { ...where, status: 'completed' } }),
    GigOrder.sum('price', { where: { ...where, status: 'completed' } }),
  ]);
  return {
    total_orders: orders,
    completed_orders: completed,
    total_revenue: Number(revenue || 0),
    average_order_value: completed ? Number(((revenue || 0) / completed).toFixed(2)) : 0,
  };
};

module.exports = { projectRevenue, gigSales };
