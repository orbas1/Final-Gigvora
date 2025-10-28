const { Op, fn, col } = require('sequelize');
const dayjs = require('dayjs');
const models = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { buildPagination, encodeCursor } = require('../utils/pagination');
const { createSlug, ensureUniqueSlug } = require('../utils/slug');
const { aggregateByPeriod } = require('../utils/analytics');

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseBoolean = (value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).toLowerCase();
  if (['true', '1', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;
  return undefined;
};

const isUuid = (value) => typeof value === 'string' && uuidRegex.test(value);

const createOrganizationService = ({
  model,
  memberModel,
  memberForeignKey,
  memberAlias,
  defaultMemberRole = 'member',
  managerRoles = ['admin'],
  allowedSortFields = ['created_at', 'updated_at', 'name'],
  selectableFields = ['id', 'name', 'slug', 'verified', 'created_at', 'updated_at'],
  analyticsLabel,
  analyticsLabelPlural = `${analyticsLabel}s`,
  allowPublicListing = true,
}) => {
  const sequelize = model.sequelize;
  const attributes = model.getAttributes ? model.getAttributes() : model.rawAttributes;
  const attributeKeys = Object.keys(attributes);
  const allowedMemberRoles = new Set([defaultMemberRole, ...managerRoles]);
  const memberTableRaw = memberModel.getTableName();
  const memberTableName = typeof memberTableRaw === 'string' ? memberTableRaw : memberTableRaw.tableName;
  const membershipAssociation = Object.values(memberModel.associations || {}).find(
    (association) => association.target === model
  );
  const managerPrimaryRole = managerRoles.includes('admin')
    ? 'admin'
    : managerRoles[0] || defaultMemberRole;

  const ensureUserExists = async (userId, transaction) => {
    if (!userId) {
      throw new ApiError(400, 'User id is required', 'VALIDATION_ERROR');
    }
    const user = await models.User.findByPk(userId, { transaction });
    if (!user) {
      throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
    }
    if (user.status && user.status !== 'active') {
      throw new ApiError(400, 'User is not active', 'USER_INACTIVE');
    }
    return user;
  };

  const ensureMemberRecord = async (
    transaction,
    orgId,
    userId,
    overrides = {},
    { allowRestore = true, resetRemoval = true } = {}
  ) => {
    const existing = await memberModel.findOne({
      where: { [memberForeignKey]: orgId, user_id: userId },
      paranoid: false,
      transaction,
    });

    const now = new Date();
    const normalizedRole = overrides.role !== undefined ? overrides.role : defaultMemberRole;

    if (existing) {
      const deletedAt = existing.get('deleted_at');
      if (deletedAt) {
        if (!allowRestore) {
          throw new ApiError(409, 'Member already exists', 'MEMBER_EXISTS');
        }
        await existing.restore({ transaction });
      } else if (!allowRestore) {
        throw new ApiError(409, 'Member already exists', 'MEMBER_EXISTS');
      }

      const updates = {};
      if (resetRemoval && existing.get('removed_at')) {
        updates.removed_at = null;
      }

      if (overrides.role !== undefined && existing.get('role') !== overrides.role) {
        updates.role = overrides.role;
      }

      ['title', 'invited_by', 'invited_at', 'joined_at'].forEach((field) => {
        if (overrides[field] !== undefined && overrides[field] !== existing.get(field)) {
          updates[field] = overrides[field];
        }
      });

      if (Object.keys(updates).length) {
        await existing.update(updates, { transaction });
      }

      return existing;
    }

    const payload = {
      [memberForeignKey]: orgId,
      user_id: userId,
      role: normalizedRole,
      title: overrides.title,
      invited_by: overrides.invited_by || userId,
      invited_at: overrides.invited_at || now,
      joined_at: overrides.joined_at || now,
    };

    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined) {
        delete payload[key];
      }
    });

    return memberModel.create(payload, { transaction });
  };

  const pickAttributes = (input) =>
    attributeKeys.reduce((acc, key) => {
      if (input[key] !== undefined) {
        acc[key] = input[key];
      }
      return acc;
    }, {});

  const buildWhere = (query) => {
    const where = {};
    const verified = parseBoolean(query.verified);
    if (verified !== undefined) {
      where.verified = verified;
    }
    if (query.slug) {
      where.slug = query.slug;
    }
    const ownerIds = toArray(query.owner_id || query.ownerId);
    if (ownerIds.length) {
      where.owner_id = { [Op.in]: ownerIds };
    }
    const ids = toArray(query.ids);
    if (ids.length) {
      where.id = { [Op.in]: ids };
    }
    if (query.q) {
      const term = `%${query.q.toLowerCase()}%`;
      where[Op.or] = [
        sequelize.where(fn('lower', col('name')), { [Op.like]: term }),
        sequelize.where(fn('lower', col('slug')), { [Op.like]: term }),
      ];
    }
    if (query.industry && attributes.industry) {
      where.industry = query.industry;
    }
    if (query.location && attributes.location) {
      where.location = query.location;
    }
    return where;
  };

  const resolveOrg = async (
    id,
    { includeDeleted = false, include, transaction } = {}
  ) => {
    const where = isUuid(id) ? { id } : { slug: id };
    const org = await model.findOne({
      where,
      paranoid: !includeDeleted,
      include,
      transaction,
    });
    if (!org) {
      throw new ApiError(404, `${analyticsLabel} not found`, `${analyticsLabel.toUpperCase()}_NOT_FOUND`);
    }
    return org;
  };

  const fetchMembership = async (orgId, userId) => {
    if (!userId) return null;
    return memberModel.findOne({
      where: { [memberForeignKey]: orgId, user_id: userId },
      paranoid: false,
    });
  };

  const assertCanManage = async (org, user, { allowOwner = true } = {}) => {
    if (!user) {
      throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
    }
    if (user.role === 'admin') return;
    if (allowOwner && org.owner_id === user.id) return;
    const membership = await fetchMembership(org.id, user.id);
    if (membership && managerRoles.includes(membership.role)) {
      return;
    }
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  };

  const buildIncludes = (query) => {
    const expand = new Set(toArray(query.expand));
    const include = [];

    if (expand.has('owner')) {
      include.push({
        association: 'owner',
        attributes: ['id', 'email', 'role', 'is_verified'],
        include: [
          {
            model: models.Profile,
            as: 'profile',
            attributes: ['id', 'display_name', 'headline', 'avatar_url'],
            required: false,
          },
        ],
      });
    }

    if (expand.has(memberAlias)) {
      include.push({
        model: memberModel,
        as: memberAlias,
        include: [
          {
            model: models.User,
            as: 'user',
            attributes: ['id', 'email', 'role', 'is_verified', 'status'],
            include: [
              {
                model: models.Profile,
                as: 'profile',
                attributes: ['id', 'display_name', 'headline', 'avatar_url'],
                required: false,
              },
            ],
          },
        ],
      });
    }

    return include;
  };

  const list = async (query, currentUser) => {
    if (!allowPublicListing && !currentUser) {
      throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
    }

    const pagination = buildPagination(query, allowedSortFields);
    const includeFlags = new Set(toArray(query.include));
    const expand = buildIncludes(query);
    const requestedFields = toArray(query.fields);
    const baseFilters = buildWhere(query);
    const where = { ...baseFilters };
    const paranoid = !(currentUser?.role === 'admin' && includeFlags.has('deleted'));

    if (pagination.cursorValue !== undefined) {
      where[pagination.sortField] = {
        ...(where[pagination.sortField] || {}),
        [pagination.cursorOperator]: pagination.cursorValue,
      };
    }

    const filteredFields = requestedFields.filter((field) => selectableFields.includes(field));
    const attributes = filteredFields.length
      ? Array.from(new Set([...filteredFields, 'id', pagination.sortField]))
      : undefined;

    if (attributes && !paranoid && attributeKeys.includes('deleted_at') && !attributes.includes('deleted_at')) {
      attributes.push('deleted_at');
    }

    const { rows, count } = await model.findAndCountAll({
      where,
      include: expand,
      paranoid,
      attributes,
      limit: pagination.limit + 1,
      order: pagination.order,
      distinct: true,
      col: 'id',
    });

    const hasMore = rows.length > pagination.limit;
    const dataRows = hasMore ? rows.slice(0, pagination.limit) : rows;
    const data = dataRows.map((row) => row.toJSON());
    const totalRecords = typeof count === 'number' ? count : Array.isArray(count) ? count.length : 0;
    const nextCursorValue = hasMore ? data[data.length - 1]?.[pagination.sortField] : undefined;
    const nextCursor = hasMore ? encodeCursor(nextCursorValue) : null;

    let analytics;
    if (parseBoolean(query.analytics)) {
      const includeForMembers = [];
      if (membershipAssociation) {
        const associationInclude = {
          association: membershipAssociation.as,
          attributes: [],
          required: true,
        };
        if (Object.keys(baseFilters).length) {
          associationInclude.where = { ...baseFilters };
        }
        if (!paranoid) {
          associationInclude.paranoid = false;
        }
        includeForMembers.push(associationInclude);
      }

      const [verified, memberCount] = await Promise.all([
        model.count({ where: { ...baseFilters, verified: true }, paranoid }),
        memberModel.count({
          where: membershipAssociation ? {} : { [memberForeignKey]: { [Op.ne]: null } },
          include: includeForMembers.length ? includeForMembers : undefined,
          distinct: true,
          col: 'id',
          paranoid,
        }),
      ]);

      analytics = {
        [`total_${analyticsLabelPlural}`]: totalRecords,
        [`verified_${analyticsLabelPlural}`]: verified,
        total_members: memberCount,
      };
    }

    return {
      data,
      total: totalRecords,
      page: {
        next_cursor: nextCursor,
        limit: pagination.limit,
      },
      analytics,
    };
  };

  const getById = async (id, query, currentUser) => {
    const includeFlags = new Set(toArray(query.include));
    const paranoid = !(currentUser?.role === 'admin' && includeFlags.has('deleted'));
    const include = buildIncludes(query);
    const org = await resolveOrg(id, { includeDeleted: !paranoid, include });
    return org.toJSON();
  };

  const create = async (payload, currentUser) => {
    if (!currentUser) {
      throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
    }

    if (payload.verified && currentUser.role !== 'admin') {
      throw new ApiError(403, 'Only administrators can verify records', 'FORBIDDEN');
    }

    if (payload.owner_id && payload.owner_id !== currentUser.id && currentUser.role !== 'admin') {
      throw new ApiError(403, 'Only administrators can reassign ownership', 'FORBIDDEN');
    }

    const ownerId = payload.owner_id || currentUser.id;
    if (ownerId !== currentUser.id) {
      await ensureUserExists(ownerId);
    }

    return sequelize.transaction(async (transaction) => {
      const slugBase = payload.slug ? createSlug(payload.slug) : createSlug(payload.name);
      const slug = await ensureUniqueSlug(model, slugBase, { transaction });

      const data = pickAttributes(payload);
      data.slug = slug;
      data.owner_id = ownerId;

      if (data.verified) {
        data.verified_at = new Date();
      }

      const org = await model.create(data, { transaction });

      await ensureMemberRecord(transaction, org.id, currentUser.id, {
        role: managerPrimaryRole,
        invited_by: currentUser.id,
        invited_at: new Date(),
        joined_at: new Date(),
      });

      if (ownerId !== currentUser.id) {
        await ensureMemberRecord(transaction, org.id, ownerId, {
          role: managerPrimaryRole,
          invited_by: currentUser.id,
          invited_at: new Date(),
          joined_at: new Date(),
        });
      }

      return org.toJSON();
    });
  };

  const update = async (id, payload, currentUser) => {
    const org = await resolveOrg(id, { includeDeleted: true });
    await assertCanManage(org, currentUser);

    if (payload.verified !== undefined && currentUser.role !== 'admin') {
      throw new ApiError(403, 'Only administrators can change verification status', 'FORBIDDEN');
    }

    const ownerChanged = payload.owner_id && payload.owner_id !== org.owner_id;
    if (ownerChanged) {
      if (currentUser.role !== 'admin') {
        throw new ApiError(403, 'Only administrators can reassign ownership', 'FORBIDDEN');
      }
      await ensureUserExists(payload.owner_id);
    }

    return sequelize.transaction(async (transaction) => {
      if (payload.name && !payload.slug) {
        const slugBase = createSlug(payload.name);
        org.slug = await ensureUniqueSlug(model, slugBase, { transaction });
      }
      if (payload.slug) {
        const slugBase = createSlug(payload.slug);
        org.slug = await ensureUniqueSlug(model, slugBase, { transaction });
      }
      if (payload.verified !== undefined) {
        org.verified = Boolean(payload.verified);
        org.verified_at = payload.verified ? new Date() : null;
      }
      if (ownerChanged) {
        org.owner_id = payload.owner_id;
      }
      const updates = pickAttributes(payload);
      delete updates.slug;
      delete updates.verified;
      delete updates.owner_id;
      Object.entries(updates).forEach(([key, value]) => {
        org.set(key, value);
      });
      await org.save({ transaction });

      if (ownerChanged) {
        await ensureMemberRecord(transaction, org.id, payload.owner_id, {
          role: managerPrimaryRole,
          invited_by: currentUser.id,
        });
      }
      return org.toJSON();
    });
  };

  const remove = async (id, currentUser) => {
    const org = await resolveOrg(id);
    await assertCanManage(org, currentUser, { allowOwner: true });

    const now = new Date();
    await sequelize.transaction(async (transaction) => {
      await memberModel.update(
        { removed_at: now },
        {
          where: { [memberForeignKey]: org.id, removed_at: null },
          transaction,
        }
      );

      await memberModel.destroy({ where: { [memberForeignKey]: org.id }, transaction });
      await org.destroy({ transaction });
    });
    return { success: true };
  };

  const listMembers = async (id, query, currentUser) => {
    const org = await resolveOrg(id);
    const membership = await fetchMembership(org.id, currentUser?.id);
    if (!currentUser || (currentUser.role !== 'admin' && org.owner_id !== currentUser.id && !membership)) {
      throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
    }

    const pagination = buildPagination(query, ['joined_at', 'created_at']);
    const includeFlags = new Set(toArray(query.include));
    const paranoid = !(currentUser?.role === 'admin' && includeFlags.has('deleted'));
    const where = { [memberForeignKey]: org.id };
    if (pagination.cursorValue !== undefined) {
      where[pagination.sortField] = {
        ...(where[pagination.sortField] || {}),
        [pagination.cursorOperator]: pagination.cursorValue,
      };
    }

    const include = [
      {
        model: models.User,
        as: 'user',
        attributes: ['id', 'email', 'role', 'is_verified', 'status'],
        include: [
          {
            model: models.Profile,
            as: 'profile',
            attributes: ['id', 'display_name', 'headline', 'avatar_url'],
            required: false,
          },
        ],
      },
    ];

    const { rows, count } = await memberModel.findAndCountAll({
      where,
      include,
      limit: pagination.limit + 1,
      order: pagination.order,
      distinct: true,
      paranoid,
      col: 'id',
    });

    const hasMore = rows.length > pagination.limit;
    const dataRows = hasMore ? rows.slice(0, pagination.limit) : rows;
    const data = dataRows.map((row) => row.toJSON());
    const totalRecords = typeof count === 'number' ? count : Array.isArray(count) ? count.length : 0;
    const nextCursorValue = hasMore ? data[data.length - 1]?.[pagination.sortField] : undefined;
    const nextCursor = hasMore ? encodeCursor(nextCursorValue) : null;

    let analytics;
    if (parseBoolean(query.analytics)) {
      const [activeMembers, managerCount] = await Promise.all([
        memberModel.count({ where: { [memberForeignKey]: org.id }, paranoid: true }),
        managerRoles.length
          ? memberModel.count({
              where: { [memberForeignKey]: org.id, role: { [Op.in]: managerRoles } },
              paranoid: true,
            })
          : Promise.resolve(0),
      ]);
      const removedMembers = !paranoid ? Math.max(totalRecords - activeMembers, 0) : 0;
      analytics = {
        total_members: totalRecords,
        active_members: activeMembers,
        manager_members: managerCount,
        removed_members: removedMembers,
      };
    }

    return {
      data,
      total: totalRecords,
      page: {
        next_cursor: nextCursor,
        limit: pagination.limit,
      },
      analytics,
    };
  };

  const addMember = async (id, payload, currentUser) => {
    const org = await resolveOrg(id);
    await assertCanManage(org, currentUser);

    await ensureUserExists(payload.user_id);

    if (payload.role && !allowedMemberRoles.has(payload.role)) {
      throw new ApiError(400, 'Invalid role supplied', 'VALIDATION_ERROR');
    }

    const parseDate = (value) => {
      if (!value) return undefined;
      const candidate = dayjs(value);
      return candidate.isValid() ? candidate.toDate() : undefined;
    };

    return sequelize.transaction(async (transaction) => {
      const existingActive = await memberModel.findOne({
        where: { [memberForeignKey]: org.id, user_id: payload.user_id },
        transaction,
      });

      if (existingActive) {
        throw new ApiError(409, 'Member already exists', 'MEMBER_EXISTS');
      }

      const invitedAt = parseDate(payload.invited_at);
      const joinedAt = parseDate(payload.joined_at);

      const member = await ensureMemberRecord(
        transaction,
        org.id,
        payload.user_id,
        {
          role: payload.role || undefined,
          title: payload.title,
          invited_by: currentUser.id,
          invited_at: invitedAt,
          joined_at: joinedAt,
        },
        { allowRestore: true }
      );

      return memberModel.findByPk(member.id, {
        include: [
          {
            model: models.User,
            as: 'user',
            attributes: ['id', 'email', 'role', 'is_verified', 'status'],
            include: [
              {
                model: models.Profile,
                as: 'profile',
                attributes: ['id', 'display_name', 'headline', 'avatar_url'],
                required: false,
              },
            ],
          },
        ],
        transaction,
      });
    });
  };

  const removeMember = async (id, userId, currentUser) => {
    const org = await resolveOrg(id);
    await assertCanManage(org, currentUser);

    if (String(userId) === String(org.owner_id)) {
      throw new ApiError(400, 'Owners cannot be removed from their organization', 'CANNOT_REMOVE_OWNER');
    }

    return sequelize.transaction(async (transaction) => {
      const member = await memberModel.findOne({
        where: { [memberForeignKey]: org.id, user_id: userId },
        transaction,
      });
      if (!member) {
        throw new ApiError(404, 'Member not found', 'MEMBER_NOT_FOUND');
      }

      if (managerRoles.includes(member.get('role'))) {
        const managerCount = await memberModel.count({
          where: { [memberForeignKey]: org.id, role: { [Op.in]: managerRoles } },
          transaction,
        });

        if (managerCount <= 1) {
          throw new ApiError(400, 'At least one manager must remain assigned', 'LAST_MANAGER_REMOVAL_FORBIDDEN');
        }
      }

      const removalTime = new Date();
      await member.update({ removed_at: removalTime }, { transaction });
      await member.destroy({ transaction });
      return { success: true };
    });
  };

  const analyticsProfile = async (id, query, currentUser) => {
    const org = await resolveOrg(id, { includeDeleted: true });
    if (!currentUser) {
      throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
    }
    const membership = await fetchMembership(org.id, currentUser.id);
    if (currentUser.role !== 'admin' && org.owner_id !== currentUser.id && !membership) {
      throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
    }

    const [totalMembers, activeMembers, verifiedMembers, joins, departures] = await Promise.all([
      memberModel.count({ where: { [memberForeignKey]: org.id }, distinct: true, col: 'id' }),
      memberModel.count({
        where: { [memberForeignKey]: org.id },
        include: [
          {
            model: models.User,
            as: 'user',
            required: true,
            where: { status: 'active' },
          },
        ],
        distinct: true,
        col: 'id',
      }),
      memberModel.count({
        where: { [memberForeignKey]: org.id },
        include: [
          {
            model: models.User,
            as: 'user',
            required: true,
            where: { is_verified: true },
          },
        ],
        distinct: true,
        col: 'id',
      }),
      aggregateByPeriod(memberModel, 'joined_at', {
        granularity: query.by || 'month',
        from: query.from,
        to: query.to,
        extraWhere: [`${memberTableName}.${memberForeignKey} = :orgId`],
        replacements: { orgId: org.id },
      }),
      aggregateByPeriod(memberModel, 'deleted_at', {
        granularity: query.by || 'month',
        from: query.from,
        to: query.to,
        includeDeleted: true,
        extraWhere: [`${memberTableName}.${memberForeignKey} = :orgId`],
        replacements: { orgId: org.id },
      }),
    ]);

    const tenureRecords = await memberModel.findAll({
      where: { [memberForeignKey]: org.id },
      attributes: ['joined_at', 'removed_at', 'updated_at', 'deleted_at'],
      paranoid: false,
    });

    let totalDays = 0;
    let tenureCount = 0;
    tenureRecords.forEach((record) => {
      const joinedAt = record.get('joined_at');
      if (!joinedAt) {
        return;
      }
      const endAt =
        record.get('removed_at') || record.get('deleted_at') || record.get('updated_at') || new Date();
      const start = dayjs(joinedAt);
      const end = dayjs(endAt);
      if (!start.isValid() || !end.isValid()) {
        return;
      }
      const diff = end.diff(start, 'day');
      if (Number.isFinite(diff)) {
        totalDays += diff;
        tenureCount += 1;
      }
    });

    const averageTenureDays = tenureCount ? Number((totalDays / tenureCount).toFixed(2)) : null;

    return {
      organization: org.toJSON(),
      metrics: {
        total_members: totalMembers,
        active_members: activeMembers,
        verified_members: verifiedMembers,
        average_tenure_days: averageTenureDays,
      },
      joins,
      departures,
    };
  };

  return {
    list,
    getById,
    create,
    update,
    remove,
    listMembers,
    addMember,
    removeMember,
    analyticsProfile,
  };
};

module.exports = { createOrganizationService };
