const { Op } = require('sequelize');

const toBase64Url = (value) =>
  Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const fromBase64Url = (value) => {
  const padLength = 4 - (value.length % 4 || 4);
  const padded = `${value}${'='.repeat(padLength % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64').toString('utf8');
};

const encodeCursor = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  const isDate = value instanceof Date;
  const payload = {
    v: isDate ? value.toISOString() : value,
    t: isDate ? 'date' : typeof value,
  };
  return toBase64Url(JSON.stringify(payload));
};

const decodeCursor = (cursor) => {
  if (!cursor) return undefined;
  try {
    const raw = fromBase64Url(cursor);
    const parsed = JSON.parse(raw);
    if (!parsed) return undefined;
    if (parsed.t === 'date' && parsed.v) {
      const parsedDate = new Date(parsed.v);
      return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
    }
    return parsed.v;
  } catch (error) {
    return undefined;
  }
};

const parseSort = (sort = 'created_at:desc') => {
  const [field = 'created_at', direction = 'desc'] = String(sort).split(':');
  const normalizedDirection = direction.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  return { field, direction: normalizedDirection };
};

const buildPagination = ({ limit = 20, cursor, sort = 'created_at:desc' }, allowedSortFields = ['created_at']) => {
  const safeFields = Array.isArray(allowedSortFields) && allowedSortFields.length ? allowedSortFields : ['created_at'];
  const { field, direction } = parseSort(sort);
  const sortField = safeFields.includes(field) ? field : safeFields[0];
  const limitValue = Math.min(Number(limit) || 20, 100);
  const decodedCursor = decodeCursor(cursor);

  return {
    limit: limitValue,
    cursorValue: decodedCursor,
    cursorOperator: direction === 'DESC' ? Op.lt : Op.gt,
    sortField,
    sortDirection: direction,
    order: [[sortField, direction]],
  };
};

module.exports = { buildPagination, encodeCursor, decodeCursor, parseSort };
