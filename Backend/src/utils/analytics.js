'use strict';

const dayjs = require('dayjs');

const normalizeDate = (value) => {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.toDate() : undefined;
};

const getQueryGenerator = (sequelize) => sequelize.getQueryInterface().queryGenerator;

const getTableName = (sequelize, model) => {
  const queryGenerator = getQueryGenerator(sequelize);
  return queryGenerator.quoteTable(model.getTableName());
};

const quoteColumn = (sequelize, column) => {
  const queryGenerator = getQueryGenerator(sequelize);
  return queryGenerator.quoteIdentifier(column);
};

const bucketExpression = (dialect, columnSql, granularity) => {
  switch (granularity) {
    case 'month':
      if (dialect === 'mysql' || dialect === 'mariadb') {
        return `DATE_FORMAT(${columnSql}, '%Y-%m')`;
      }
      if (dialect === 'sqlite') {
        return `strftime('%Y-%m', ${columnSql})`;
      }
      return `DATE_TRUNC('month', ${columnSql})`;
    case 'week':
      if (dialect === 'mysql' || dialect === 'mariadb') {
        return `DATE_FORMAT(${columnSql}, '%x-%v')`;
      }
      if (dialect === 'sqlite') {
        return `strftime('%Y-%W', ${columnSql})`;
      }
      return `DATE_TRUNC('week', ${columnSql})`;
    case 'day':
    default:
      if (dialect === 'mysql' || dialect === 'mariadb') {
        return `DATE_FORMAT(${columnSql}, '%Y-%m-%d')`;
      }
      if (dialect === 'sqlite') {
        return `strftime('%Y-%m-%d', ${columnSql})`;
      }
      return `DATE_TRUNC('day', ${columnSql})`;
  }
};

const formatBucketValue = (dialect, granularity, value) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    const iso = value.toISOString();
    if (granularity === 'month') {
      return iso.slice(0, 7);
    }
    if (granularity === 'day') {
      return iso.slice(0, 10);
    }
    return iso;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    if (dialect === 'sqlite') {
      const asDate = new Date(value * 1000);
      return asDate.toISOString();
    }
    return String(value);
  }

  return String(value);
};

const aggregateByPeriod = async (
  model,
  column,
  {
    granularity = 'day',
    from,
    to,
    includeDeleted = false,
    distinct = null,
    extraWhere = [],
    replacements: customReplacements = {},
  } = {}
) => {
  const sequelize = model.sequelize;
  const dialect = sequelize.getDialect();
  const table = getTableName(sequelize, model);
  const columnSql = `${table}.${quoteColumn(sequelize, column)}`;
  const bucketExpr = bucketExpression(dialect, columnSql, granularity);
  const countExpression = distinct
    ? `COUNT(DISTINCT ${table}.${quoteColumn(sequelize, distinct)})`
    : 'COUNT(*)';

  const whereParts = Array.isArray(extraWhere) ? [...extraWhere] : [extraWhere];
  const replacements = { ...customReplacements };
  const fromDate = normalizeDate(from);
  const toDate = normalizeDate(to);

  if (fromDate) {
    whereParts.push(`${columnSql} >= :from`);
    replacements.from = fromDate;
  }
  if (toDate) {
    whereParts.push(`${columnSql} <= :to`);
    replacements.to = toDate;
  }

  if (model.options?.paranoid && !includeDeleted) {
    const deletedColumn = `${table}.${quoteColumn(sequelize, 'deleted_at')}`;
    whereParts.push(`${deletedColumn} IS NULL`);
  }

  const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const query = `SELECT ${bucketExpr} AS bucket, ${countExpression} AS count FROM ${table} ${whereClause} GROUP BY bucket ORDER BY bucket ASC`;

  const [rows] = await sequelize.query(query, {
    replacements,
    type: sequelize.QueryTypes.SELECT,
    raw: true,
  });

  return rows.map((row) => ({
    bucket: formatBucketValue(dialect, granularity, row.bucket),
    count: Number(row.count),
  }));
};

module.exports = { aggregateByPeriod };
