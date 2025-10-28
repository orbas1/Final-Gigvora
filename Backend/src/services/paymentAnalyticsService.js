const dayjs = require('dayjs');
const { Op } = require('sequelize');
const { EscrowIntent } = require('../models');

const normalizeDate = (value) => {
  if (!value) return undefined;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.toDate() : undefined;
};

const bucketExpression = (dialect, column, granularity) => {
  switch (granularity) {
    case 'month':
      if (dialect === 'mysql' || dialect === 'mariadb') return `DATE_FORMAT(${column}, '%Y-%m')`;
      if (dialect === 'sqlite') return `strftime('%Y-%m', ${column})`;
      return `DATE_TRUNC('month', ${column})`;
    case 'week':
      if (dialect === 'mysql' || dialect === 'mariadb') return `DATE_FORMAT(${column}, '%x-%v')`;
      if (dialect === 'sqlite') return `strftime('%Y-%W', ${column})`;
      return `DATE_TRUNC('week', ${column})`;
    case 'day':
    default:
      if (dialect === 'mysql' || dialect === 'mariadb') return `DATE_FORMAT(${column}, '%Y-%m-%d')`;
      if (dialect === 'sqlite') return `strftime('%Y-%m-%d', ${column})`;
      return `DATE_TRUNC('day', ${column})`;
  }
};

const formatBucketValue = (dialect, granularity, value) => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    const iso = value.toISOString();
    if (granularity === 'month') return iso.slice(0, 7);
    if (granularity === 'day') return iso.slice(0, 10);
    return iso;
  }
  return String(value);
};

const gmv = async ({ from, to, by = 'day' }) => {
  const granularity = ['day', 'week', 'month'].includes(by) ? by : 'day';
  const sequelize = EscrowIntent.sequelize;
  const dialect = sequelize.getDialect();
  const table = sequelize.getQueryInterface().quoteTable(EscrowIntent.getTableName());
  const column = `${table}.${sequelize.getQueryInterface().quoteIdentifier('captured_at')}`;
  const bucketExpr = bucketExpression(dialect, column, granularity);
  const conditions = [
    `${table}.${sequelize.getQueryInterface().quoteIdentifier('captured_at')} IS NOT NULL`,
    `${table}.${sequelize.getQueryInterface().quoteIdentifier('status')} IN ('captured','refunded')`,
  ];
  const fromDate = normalizeDate(from);
  const toDate = normalizeDate(to);
  const replacements = {};
  if (fromDate) {
    conditions.push(`${table}.${sequelize.getQueryInterface().quoteIdentifier('captured_at')} >= :from`);
    replacements.from = fromDate;
  }
  if (toDate) {
    conditions.push(`${table}.${sequelize.getQueryInterface().quoteIdentifier('captured_at')} <= :to`);
    replacements.to = toDate;
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const query = `SELECT ${bucketExpr} AS bucket, SUM(${table}.${sequelize.getQueryInterface().quoteIdentifier('captured_amount')}) AS amount FROM ${table} ${whereClause} GROUP BY bucket ORDER BY bucket`;
  const rows = await sequelize.query(query, {
    replacements,
    type: sequelize.QueryTypes.SELECT,
  });
  return rows.map((row) => ({ bucket: formatBucketValue(dialect, granularity, row.bucket), amount: Number(row.amount || 0) }));
};

const takeRate = async ({ from, to }) => {
  const sequelize = EscrowIntent.sequelize;
  const where = { status: { [Op.in]: ['captured', 'refunded'] } };
  if (from || to) {
    where.captured_at = {};
    if (from) where.captured_at[Op.gte] = normalizeDate(from);
    if (to) where.captured_at[Op.lte] = normalizeDate(to);
  }
  const totals = await EscrowIntent.findAll({
    attributes: [
      [sequelize.fn('SUM', sequelize.col('captured_amount')), 'captured'],
      [sequelize.fn('SUM', sequelize.col('fee_amount')), 'fees'],
    ],
    where,
    raw: true,
  });
  const captured = Number(totals?.[0]?.captured || 0);
  const fees = Number(totals?.[0]?.fees || 0);
  const takeRateValue = captured === 0 ? 0 : Number((fees / captured).toFixed(4));
  return { captured, fees, take_rate: takeRateValue };
};

const disputesRate = async ({ from, to }) => {
  const sequelize = EscrowIntent.sequelize;
  const where = {};
  if (from || to) {
    where.created_at = {};
    if (from) where.created_at[Op.gte] = normalizeDate(from);
    if (to) where.created_at[Op.lte] = normalizeDate(to);
  }
  const [total, disputed] = await Promise.all([
    EscrowIntent.count({ where }),
    EscrowIntent.count({ where: { ...where, is_on_hold: true } }),
  ]);
  const disputeRate = total === 0 ? 0 : Number((disputed / total).toFixed(4));
  return { total, disputed, dispute_rate: disputeRate };
};

module.exports = { gmv, takeRate, disputesRate };
