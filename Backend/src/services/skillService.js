const { Op, fn, col } = require('sequelize');
const { Skill, Profile, ProfileSkill, sequelize } = require('../models');
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
    where[Op.or] = [sequelize.where(fn('lower', col('Skill.name')), { [Op.like]: term })];
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

  const rows = await Skill.findAll({
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

  const total = await Skill.count({ where, paranoid });

  let analytics;
  if (query.analytics === 'true') {
    const [deletedCount, usageRows, attachmentCount] = await Promise.all([
      currentUser?.role === 'admin'
        ? Skill.count({ where: { ...where, deleted_at: { [Op.ne]: null } }, paranoid: false })
        : Promise.resolve(null),
      ProfileSkill.findAll({
        attributes: ['skill_id', [fn('COUNT', col('*')), 'profiles']],
        group: ['skill_id'],
        order: [[fn('COUNT', col('*')), 'DESC']],
        limit: 5,
      }),
      ProfileSkill.count(),
    ]);
    const skillIds = usageRows.map((row) => row.get('skill_id'));
    const skillMap = skillIds.length
      ? await Skill.findAll({
          attributes: ['id', 'name'],
          where: { id: skillIds },
          paranoid: false,
        })
      : [];
    const nameLookup = new Map(skillMap.map((skill) => [skill.id, skill.name]));
    analytics = {
      total,
      deleted: deletedCount === null ? undefined : deletedCount,
      attached_profiles: attachmentCount,
      top_usage: usageRows.map((row) => {
        const skillId = row.get('skill_id');
        return {
          skill_id: skillId,
          name: nameLookup.get(skillId) || null,
          profiles: Number(row.get('profiles')) || 0,
        };
      }),
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

const getById = async (id, options = {}, currentUser) => {
  const includes = new Set(parseListParam(options.include));
  const expand = new Set(parseListParam(options.expand));
  const fields = parseListParam(options.fields).filter((field) => selectableFields.includes(field));

  const paranoid = !(includes.has('deleted') && currentUser?.role === 'admin');

  const include = [];
  if (expand.has('profiles')) {
    include.push({
      model: Profile,
      as: 'profiles',
      attributes: ['id', 'display_name'],
      through: { attributes: [] },
    });
  }

  const attributes = fields.length ? Array.from(new Set([...fields, 'id'])).filter(Boolean) : undefined;

  const skill = await Skill.findByPk(id, { paranoid, include, attributes });
  if (!skill) {
    throw new ApiError(404, 'Skill not found', 'SKILL_NOT_FOUND');
  }
  return serialize(skill);
};

const create = async (payload) => {
  try {
    const skill = await Skill.create({
      name: payload.name.trim(),
      description: payload.description,
    });
    return skill.toJSON();
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      throw new ApiError(409, 'Skill already exists', 'SKILL_CONFLICT');
    }
    throw error;
  }
};

const update = async (id, payload) => {
  const skill = await Skill.findByPk(id, { paranoid: false });
  if (!skill) {
    throw new ApiError(404, 'Skill not found', 'SKILL_NOT_FOUND');
  }
  try {
    await skill.update({
      ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
      ...(payload.description !== undefined ? { description: payload.description } : {}),
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      throw new ApiError(409, 'Skill already exists', 'SKILL_CONFLICT');
    }
    throw error;
  }
  return skill.toJSON();
};

const remove = async (id) => {
  const skill = await Skill.findByPk(id);
  if (!skill) {
    throw new ApiError(404, 'Skill not found', 'SKILL_NOT_FOUND');
  }
  await skill.destroy();
  return { success: true };
};

const suggest = async ({ q, limit = 10 }) => {
  const where = {};
  if (q) {
    const term = `%${String(q).toLowerCase()}%`;
    where[Op.or] = [sequelize.where(fn('lower', col('Skill.name')), { [Op.like]: term })];
  }
  const results = await Skill.findAll({
    where,
    limit: Math.min(Number(limit) || 10, 25),
    order: [['name', 'ASC']],
  });
  return results.map((row) => row.toJSON());
};

module.exports = { list, getById, create, update, remove, suggest };
