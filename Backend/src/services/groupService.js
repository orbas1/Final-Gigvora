const { Op, fn, col } = require('sequelize');
const dayjs = require('dayjs');
const {
  Group,
  GroupMember,
  GroupTag,
  Tag,
  User,
  Post,
  sequelize,
} = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { buildPagination, encodeCursor } = require('../utils/pagination');
const { aggregateByPeriod } = require('../utils/analytics');

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const normalizeRole = (role) => {
  if (!role) return undefined;
  const value = String(role).toLowerCase();
  if (value === 'moderator') return 'mod';
  if (['member', 'mod', 'owner'].includes(value)) return value;
  return undefined;
};

const slugify = (name) => {
  const base = String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || `group-${Date.now()}`;
};

const ensureUniqueSlug = async (slug, excludeId = null, transaction) => {
  let candidate = slug;
  let attempts = 0;
  while (true) {
    const where = { slug: candidate };
    if (excludeId) {
      where.id = { [Op.ne]: excludeId };
    }
    const existing = await Group.findOne({ where, paranoid: false, transaction });
    if (!existing) {
      return candidate;
    }
    attempts += 1;
    candidate = `${slug}-${attempts}`;
  }
};

const syncTags = async (groupId, tags, transaction) => {
  if (!Array.isArray(tags)) return;
  const normalized = Array.from(
    new Set(
      tags
        .map((tag) => String(tag || '').trim())
        .filter(Boolean)
    )
  );
  const existingLinks = await GroupTag.findAll({
    where: { group_id: groupId },
    transaction,
    raw: true,
  });
  const existingMap = new Map(existingLinks.map((link) => [link.tag_id, true]));
  const tagInstances = await Promise.all(
    normalized.map(async (name) => {
      const [tag] = await Tag.findOrCreate({
        where: { name },
        defaults: { description: null },
        transaction,
      });
      return tag;
    })
  );
  const keepIds = tagInstances.map((tag) => tag.id);
  if (keepIds.length) {
    const missing = keepIds.filter((id) => !existingMap.has(id)).map((id) => ({ group_id: groupId, tag_id: id }));
    if (missing.length) {
      await GroupTag.bulkCreate(missing, { ignoreDuplicates: true, transaction });
    }
  }
  await GroupTag.destroy({
    where: {
      group_id: groupId,
      ...(keepIds.length ? { tag_id: { [Op.notIn]: keepIds } } : {}),
    },
    transaction,
  });
};

const hydrateCounts = async (groups) => {
  if (!groups.length) return groups;
  const ids = groups.map((group) => group.id);
  const counts = await GroupMember.findAll({
    attributes: ['group_id', [fn('COUNT', col('group_id')), 'count']],
    where: { group_id: { [Op.in]: ids } },
    group: ['group_id'],
    raw: true,
  });
  const map = counts.reduce((acc, entry) => {
    acc[entry.group_id] = Number(entry.count);
    return acc;
  }, {});
  return groups.map((group) => {
    const { memberships, ...rest } = group;
    return {
      ...rest,
      member_count: map[group.id] || 0,
    };
  });
};

const fetchGroup = async (id, { includeDeleted = false, transaction } = {}) => {
  const group = await Group.findByPk(id, {
    include: [
      { model: Tag, as: 'tags', attributes: ['id', 'name'], through: { attributes: [] } },
      { model: User, as: 'owner', attributes: ['id', 'email'] },
    ],
    paranoid: !includeDeleted,
    transaction,
  });
  if (!group) {
    throw new ApiError(404, 'Group not found', 'GROUP_NOT_FOUND');
  }
  return group;
};

const assertCanAccess = async (group, user) => {
  if (group.visibility === 'public') return null;
  if (!user) {
    throw new ApiError(403, 'Group is private', 'GROUP_PRIVATE');
  }
  if (user.role === 'admin') return null;
  const membership = await GroupMember.findOne({ where: { group_id: group.id, user_id: user.id } });
  if (!membership) {
    throw new ApiError(403, 'Group is private', 'GROUP_PRIVATE');
  }
  return membership;
};

const listGroups = async (query, currentUser) => {
  const pagination = buildPagination(query, ['created_at', 'updated_at', 'name']);
  const includeFlags = new Set(toArray(query.include));
  const expandFlags = new Set(toArray(query.expand));
  const requestedFields = toArray(query.fields);
  const tagFilter = toArray(query.tags);
  const paranoid = !(currentUser?.role === 'admin' && includeFlags.has('deleted'));

  const where = { [Op.and]: [] };
  if (query.q) {
    const term = `%${String(query.q).toLowerCase()}%`;
    where[Op.and].push({
      [Op.or]: [
        sequelize.where(fn('lower', col('Group.name')), { [Op.like]: term }),
        sequelize.where(fn('lower', col('Group.description')), { [Op.like]: term }),
      ],
    });
  }
  if (pagination.cursorValue !== undefined) {
    where[Op.and].push({
      [pagination.sortField]: {
        [pagination.cursorOperator]: pagination.cursorValue,
      },
    });
  }

  const include = [];
  if (!currentUser || currentUser.role !== 'admin') {
    include.push({
      model: GroupMember,
      as: 'memberships',
      attributes: [],
      required: false,
      ...(currentUser ? { where: { user_id: currentUser.id } } : {}),
    });
    const accessRules = [{ visibility: 'public' }];
    if (currentUser) {
      accessRules.push({ created_by: currentUser.id });
      accessRules.push(sequelize.where(col('memberships.user_id'), currentUser.id));
    }
    where[Op.and].push({ [Op.or]: accessRules });
  }
  if (tagFilter.length) {
    include.push({
      model: Tag,
      as: 'tags',
      attributes: ['id', 'name'],
      through: { attributes: [] },
      where: { name: { [Op.in]: tagFilter } },
      required: true,
    });
  } else if (expandFlags.has('tags')) {
    include.push({ model: Tag, as: 'tags', attributes: ['id', 'name'], through: { attributes: [] } });
  }
  if (expandFlags.has('owner')) {
    include.push({ model: User, as: 'owner', attributes: ['id', 'email'] });
  }

  const attributes = requestedFields.length
    ? Array.from(new Set([...requestedFields, 'id', pagination.sortField]))
    : undefined;

  const whereClause = where[Op.and].length ? where : {};

  const { rows, count } = await Group.findAndCountAll({
    where: whereClause,
    include,
    attributes,
    paranoid,
    limit: pagination.limit + 1,
    order: pagination.order,
    distinct: true,
    col: 'Group.id',
    subQuery: false,
  });

  const hasMore = rows.length > pagination.limit;
  const dataRows = hasMore ? rows.slice(0, pagination.limit) : rows;
  const payload = await hydrateCounts(
    dataRows.map((row) => {
      const { memberships, ...rest } = row.toJSON();
      return rest;
    })
  );
  const nextCursorValue = hasMore ? payload[payload.length - 1]?.[pagination.sortField] : undefined;
  const nextCursor = hasMore ? encodeCursor(nextCursorValue) : null;

  let analytics;
  if (query.analytics === true) {
    const [activeGroups, deletedGroups, totalMembers] = await Promise.all([
      Group.count(),
      Group.count({ paranoid: false, where: { deleted_at: { [Op.ne]: null } } }),
      GroupMember.count(),
    ]);
    analytics = {
      active_groups: activeGroups,
      deleted_groups: deletedGroups,
      total_memberships: totalMembers,
    };
  }

  return {
    data: payload,
    total: typeof count === 'number' ? count : count.length,
    page: {
      limit: pagination.limit,
      next_cursor: nextCursor,
    },
    analytics,
  };
};

const createGroup = async (actor, body) => {
  if (!actor) throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  return sequelize.transaction(async (transaction) => {
    const baseSlug = slugify(body.slug || body.name);
    const slug = await ensureUniqueSlug(baseSlug, null, transaction);
    const group = await Group.create(
      {
        name: body.name,
        slug,
        description: body.description,
        visibility: body.visibility || 'public',
        cover_image_url: body.cover_image_url,
        metadata: body.metadata,
        created_by: actor.id,
      },
      { transaction }
    );
    const ownerMembership = await GroupMember.create(
      {
        group_id: group.id,
        user_id: actor.id,
        role: 'owner',
        joined_at: new Date(),
      },
      { transaction }
    );
    if (body.tags !== undefined) {
      await syncTags(group.id, body.tags, transaction);
    }
    const created = await fetchGroup(group.id, { transaction });
    const payload = created.toJSON();
    payload.member_count = 1;
    payload.owner_count = 1;
    payload.moderator_count = 0;
    payload.viewer_membership = {
      id: ownerMembership.id,
      role: ownerMembership.role,
      joined_at: ownerMembership.joined_at,
    };
    return payload;
  });
};

const updateGroup = async (id, actor, body) => {
  if (!actor) throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  const groupId = await sequelize.transaction(async (transaction) => {
    const group = await fetchGroup(id, { includeDeleted: true, transaction });
    if (group.deleted_at && actor.role !== 'admin') {
      throw new ApiError(404, 'Group not found', 'GROUP_NOT_FOUND');
    }
    if (actor.role !== 'admin' && group.created_by !== actor.id) {
      const membership = await GroupMember.findOne({
        where: { group_id: id, user_id: actor.id },
        transaction,
      });
      if (!membership || membership.role !== 'owner') {
        throw new ApiError(403, 'Only owners can update the group', 'FORBIDDEN');
      }
    }
    if (body.name && !body.slug) {
      body.slug = slugify(body.name);
    }
    if (body.slug) {
      group.slug = await ensureUniqueSlug(slugify(body.slug), group.id, transaction);
    }
    if (body.name) group.name = body.name;
    if (body.description !== undefined) group.description = body.description;
    if (body.visibility) group.visibility = body.visibility;
    if (body.cover_image_url !== undefined) group.cover_image_url = body.cover_image_url;
    if (body.metadata !== undefined) group.metadata = body.metadata;
    await group.save({ transaction });
    if (body.tags !== undefined) {
      await syncTags(group.id, body.tags, transaction);
    }
    return group.id;
  });
  return getGroup(groupId, actor, { includeDeleted: actor.role === 'admin' });
};

const deleteGroup = async (id, actor) => {
  if (!actor) throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  const group = await fetchGroup(id, { includeDeleted: true });
  if (group.deleted_at) {
    return { success: true };
  }
  if (actor.role !== 'admin' && group.created_by !== actor.id) {
    const membership = await GroupMember.findOne({ where: { group_id: id, user_id: actor.id } });
    if (!membership || membership.role !== 'owner') {
      throw new ApiError(403, 'Only owners can delete the group', 'FORBIDDEN');
    }
  }
  await group.destroy();
  return { success: true };
};

const getGroup = async (id, currentUser, options = {}) => {
  const includeDeleted = currentUser?.role === 'admin' && options.includeDeleted;
  const group = await fetchGroup(id, { includeDeleted });
  if (group.deleted_at && !includeDeleted) {
    throw new ApiError(404, 'Group not found', 'GROUP_NOT_FOUND');
  }
  const membership = await assertCanAccess(group, currentUser).catch((error) => {
    if (error instanceof ApiError && error.code === 'GROUP_PRIVATE' && includeDeleted) {
      return null;
    }
    throw error;
  });
  const [memberCount, modCount, ownerCount] = await Promise.all([
    GroupMember.count({ where: { group_id: group.id } }),
    GroupMember.count({ where: { group_id: group.id, role: 'mod' } }),
    GroupMember.count({ where: { group_id: group.id, role: 'owner' } }),
  ]);
  const payload = group.toJSON();
  payload.member_count = memberCount;
  payload.moderator_count = modCount;
  payload.owner_count = ownerCount;
  payload.viewer_membership =
    membership && membership.id
      ? { id: membership.id, role: membership.role, joined_at: membership.joined_at }
      : null;
  return payload;
};

const joinGroup = async (id, user) => {
  if (!user) throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  const group = await fetchGroup(id);
  return sequelize.transaction(async (transaction) => {
    const existing = await GroupMember.findOne({
      where: { group_id: id, user_id: user.id },
      paranoid: false,
      transaction,
    });
    if (existing && !existing.deleted_at) {
      throw new ApiError(409, 'Already a member of this group', 'ALREADY_MEMBER');
    }
    if (!existing && group.visibility === 'private' && user.role !== 'admin') {
      throw new ApiError(403, 'Group is private', 'GROUP_PRIVATE');
    }
    if (existing && existing.deleted_at) {
      await existing.restore({ transaction });
      existing.role = existing.role || 'member';
      existing.joined_at = new Date();
      await existing.save({ transaction });
      return existing.toJSON();
    }
    const membership = await GroupMember.create(
      {
        group_id: id,
        user_id: user.id,
        role: 'member',
        joined_at: new Date(),
      },
      { transaction }
    );
    return membership.toJSON();
  });
};

const leaveGroup = async (id, user) => {
  if (!user) throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  const membership = await GroupMember.findOne({ where: { group_id: id, user_id: user.id } });
  if (!membership) {
    throw new ApiError(404, 'Membership not found', 'MEMBERSHIP_NOT_FOUND');
  }
  if (membership.role === 'owner') {
    const otherOwners = await GroupMember.count({
      where: {
        group_id: id,
        role: 'owner',
        id: { [Op.ne]: membership.id },
      },
    });
    if (!otherOwners) {
      throw new ApiError(400, 'Transfer ownership before leaving the group', 'LAST_OWNER');
    }
  }
  await membership.destroy();
  return { success: true };
};

const listMembers = async (groupId, query, currentUser) => {
  const group = await fetchGroup(groupId);
  await assertCanAccess(group, currentUser);
  const pagination = buildPagination(query, ['joined_at', 'created_at']);
  const roleFilter = normalizeRole(query.role);
  const where = { group_id: groupId };
  if (roleFilter) where.role = roleFilter;
  if (pagination.cursorValue !== undefined) {
    where[pagination.sortField] = {
      ...(where[pagination.sortField] || {}),
      [pagination.cursorOperator]: pagination.cursorValue,
    };
  }
  const include = [
    { model: User, as: 'user', attributes: ['id', 'email', 'role'] },
  ];
  const { rows, count } = await GroupMember.findAndCountAll({
    where,
    include,
    limit: pagination.limit + 1,
    order: pagination.order,
    distinct: true,
    col: 'GroupMember.id',
  });
  const hasMore = rows.length > pagination.limit;
  const dataRows = hasMore ? rows.slice(0, pagination.limit) : rows;
  const data = dataRows.map((row) => row.toJSON());
  const nextCursorValue = hasMore ? data[data.length - 1]?.[pagination.sortField] : undefined;
  const nextCursor = hasMore ? encodeCursor(nextCursorValue) : null;

  let analytics;
  if (query.analytics === true) {
    const [totalMembers, totalMods, totalOwners] = await Promise.all([
      GroupMember.count({ where: { group_id: groupId } }),
      GroupMember.count({ where: { group_id: groupId, role: 'mod' } }),
      GroupMember.count({ where: { group_id: groupId, role: 'owner' } }),
    ]);
    analytics = {
      total_members: totalMembers,
      moderators: totalMods,
      owners: totalOwners,
    };
  }

  return {
    data,
    total: typeof count === 'number' ? count : count.length,
    page: {
      limit: pagination.limit,
      next_cursor: nextCursor,
    },
    analytics,
  };
};

const updateMemberRole = async (groupId, memberUserId, actor, body) => {
  if (!actor) throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  const group = await fetchGroup(groupId);
  const actorMembership = await GroupMember.findOne({ where: { group_id: groupId, user_id: actor.id } });
  if (actor.role !== 'admin' && (!actorMembership || actorMembership.role !== 'owner')) {
    throw new ApiError(403, 'Only owners or admins may update member roles', 'FORBIDDEN');
  }
  const membership = await GroupMember.findOne({ where: { group_id: groupId, user_id: memberUserId } });
  if (!membership) {
    throw new ApiError(404, 'Membership not found', 'MEMBERSHIP_NOT_FOUND');
  }
  const targetRole = normalizeRole(body.role);
  if (!targetRole) {
    throw new ApiError(400, 'Invalid role', 'INVALID_ROLE');
  }
  if (membership.role === 'owner' && targetRole !== 'owner') {
    const otherOwners = await GroupMember.count({
      where: {
        group_id: groupId,
        role: 'owner',
        id: { [Op.ne]: membership.id },
      },
    });
    if (!otherOwners) {
      throw new ApiError(400, 'A group must have at least one owner', 'LAST_OWNER');
    }
  }
  membership.role = targetRole;
  await membership.save();
  return membership.toJSON();
};

const groupAnalytics = async (groupId, query, currentUser) => {
  const group = await fetchGroup(groupId);
  await assertCanAccess(group, currentUser);
  const from = query.from ? new Date(query.from) : dayjs().subtract(30, 'day').toDate();
  const to = query.to ? new Date(query.to) : new Date();
  const granularity = ['day', 'week', 'month'].includes(query.by) ? query.by : 'week';
  const [memberCount, postCount, memberGrowth, postGrowth] = await Promise.all([
    GroupMember.count({ where: { group_id: groupId } }),
    Post.count({ where: { group_id: groupId } }),
    aggregateByPeriod(GroupMember, 'joined_at', {
      from,
      to,
      granularity,
      extraWhere: ['group_id = :groupId'],
      replacements: { groupId },
    }),
    aggregateByPeriod(Post, 'created_at', {
      from,
      to,
      granularity,
      extraWhere: ['group_id = :groupId'],
      replacements: { groupId },
    }),
  ]);
  const recentMembers = await GroupMember.count({
    where: {
      group_id: groupId,
      joined_at: { [Op.gte]: dayjs().subtract(30, 'day').toDate() },
    },
  });
  const recentPosts = await Post.count({
    where: {
      group_id: groupId,
      created_at: { [Op.gte]: dayjs().subtract(30, 'day').toDate() },
    },
  });
  return {
    members: {
      total: memberCount,
      new_last_30_days: recentMembers,
    },
    posts: {
      total: postCount,
      new_last_30_days: recentPosts,
    },
    growth: {
      members: memberGrowth,
      posts: postGrowth,
      granularity,
      range: { from, to },
    },
  };
};

module.exports = {
  listGroups,
  createGroup,
  getGroup,
  updateGroup,
  deleteGroup,
  joinGroup,
  leaveGroup,
  listMembers,
  updateMemberRole,
  groupAnalytics,
};
