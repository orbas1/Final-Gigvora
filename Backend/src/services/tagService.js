const { Op, fn, col } = require('sequelize');
const { Tag, Profile, sequelize } = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { buildPagination, encodeCursor } = require('../utils/pagination');

const parseListParam = (value) => {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const selectableFields = ['id', 'name', 'description', 'created_at', 'updated_at'];

const serialize = (record) => {
  const json = record.toJSON();
  if (json.profiles) {
    json.profiles = json.profiles.map((profile) => ({ id: profile.id, display_name: profile.display_name }));
  }
  return json;
};

const list = async (query, currentUser) => {
  const pagination = buildPagination(query, ['created_at', 'updated_at', 'name']);
  const includes = new Set(parseListParam(query.include));
  const expand = new Set(parseListParam(query.expand));
  const fields = parseListParam(query.fields).filter((field) => selectableFields.includes(field));

  const paranoid = !(includes.has('deleted') && currentUser?.role === 'admin');

  const where = {};
  if (query.q) {
    const term = `%${String(query.q).toLowerCase()}%`;
    where[Op.or] = [sequelize.where(fn('lower', col('Tag.name')), { [Op.like]: term })];
  }

  const listWhere = { ...where };
  if (pagination.cursorValue !== undefined) {
    listWhere[pagination.sortField] = {
      [pagination.cursorOperator]: pagination.cursorValue,
    };
  }

  const include = [];
  if (expand.has('profiles')) {
    include.push({
      model: Profile,
      as: 'profiles',
      attributes: ['id', 'display_name'],
      through: { attributes: [] },
    });
  }

  const attributes = fields.length ? Array.from(new Set([...fields, 'id', pagination.sortField])) : undefined;

  const rows = await Tag.findAll({
    where: listWhere,
    attributes,
    include,
    paranoid,
    order: pagination.order,
    limit: pagination.limit + 1,
    distinct: true,
  });

  const hasMore = rows.length > pagination.limit;
  const sliced = hasMore ? rows.slice(0, pagination.limit) : rows;
  const data = sliced.map(serialize);
  const nextCursorValue = hasMore ? sliced[sliced.length - 1]?.[pagination.sortField] : undefined;

  const total = await Tag.count({ where, paranoid });

  let analytics;
  if (query.analytics === 'true') {
    const deletedCount = currentUser?.role === 'admin'
      ? await Tag.count({ where: { ...where, deleted_at: { [Op.ne]: null } }, paranoid: false })
      : undefined;
    analytics = {
      total,
      deleted: deletedCount ?? undefined,
    };
  }

  return {
    data,
    page: {
      next_cursor: hasMore ? encodeCursor(nextCursorValue) : null,
      limit: pagination.limit,
    },
    total,
    analytics,
  };
};

const create = async (payload) => {
  try {
    const tag = await Tag.create({
      name: payload.name.trim(),
      description: payload.description,
    });
    return tag.toJSON();
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      throw new ApiError(409, 'Tag already exists', 'TAG_CONFLICT');
    }
    throw error;
  }
};

const update = async (id, payload) => {
  const tag = await Tag.findByPk(id, { paranoid: false });
  if (!tag) {
    throw new ApiError(404, 'Tag not found', 'TAG_NOT_FOUND');
  }
  await tag.update({
    ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
    ...(payload.description !== undefined ? { description: payload.description } : {}),
  });
  return tag.toJSON();
};

const remove = async (id) => {
  const tag = await Tag.findByPk(id);
  if (!tag) {
    throw new ApiError(404, 'Tag not found', 'TAG_NOT_FOUND');
  }
  await tag.destroy();
  return { success: true };
};

const suggest = async ({ q, limit = 10 }) => {
  const where = {};
  if (q) {
    const term = `%${String(q).toLowerCase()}%`;
    where[Op.or] = [sequelize.where(fn('lower', col('Tag.name')), { [Op.like]: term })];
  }
  const results = await Tag.findAll({
    where,
    limit: Math.min(Number(limit) || 10, 25),
    order: [['name', 'ASC']],
  });
  return results.map((row) => row.toJSON());
};

module.exports = { list, create, update, remove, suggest };
