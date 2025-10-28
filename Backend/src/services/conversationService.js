const dayjs = require('dayjs');
const { Op } = require('sequelize');
const config = require('../config');
const {
  Conversation,
  ConversationParticipant,
  Message,
  MessageRead,
  User,
  sequelize,
} = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { buildPagination, encodeCursor } = require('../utils/pagination');
const { aggregateByPeriod } = require('../utils/analytics');
const { emitToConversation, emitToUsers } = require('../lib/realtime');

const EDIT_WINDOW_MINUTES = Number(config.realtime?.messageEditWindowMinutes || 15);

const analyticsRequested = (value) => String(value || '').toLowerCase() === 'true';

const likeOperator = () => (sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like);

const hasExpand = (expandSet, key) =>
  Array.from(expandSet || []).some((value) => value === key || value.startsWith(`${key}.`));

const buildParticipantInclude = () => ({
  model: ConversationParticipant,
  as: 'participants',
  where: { left_at: null },
  required: false,
  include: [
    {
      model: User,
      as: 'user',
      attributes: ['id', 'email', 'role', 'active_role'],
    },
  ],
});

const normalizeFields = (fields = [], required = ['id']) => {
  const selected = Array.isArray(fields) ? fields.map((field) => String(field).trim()).filter(Boolean) : [];
  if (!selected.length) {
    return undefined;
  }
  const baseline = Array.isArray(required) ? required : ['id'];
  const set = new Set([...baseline, ...selected]);
  return Array.from(set);
};

const resolveConversationAccess = async (
  conversationId,
  user,
  { includeDeleted = false, transaction, lock, requireParticipant = true } = {}
) => {
  if (!user) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  const conversation = await Conversation.findByPk(conversationId, { paranoid: !includeDeleted, transaction, lock });
  if (!conversation || (!includeDeleted && conversation.deleted_at)) {
    throw new ApiError(404, 'Conversation not found', 'CONVERSATION_NOT_FOUND');
  }

  if (user.role === 'admin' && !requireParticipant) {
    return { conversation, participant: null };
  }

  const participant = await ConversationParticipant.findOne({
    where: { conversation_id: conversationId, user_id: user.id, left_at: null },
    transaction,
    lock,
  });

  if (!participant && user.role !== 'admin') {
    throw new ApiError(404, 'Conversation not found', 'CONVERSATION_NOT_FOUND');
  }

  return { conversation, participant };
};

const fetchConversation = async (id, { includeDeleted = false } = {}) => {
  const conversation = await Conversation.findByPk(id, {
    include: [buildParticipantInclude()],
    paranoid: !includeDeleted,
  });
  return conversation;
};

const listConversations = async (user, query = {}) => {
  const scope = query.scope || 'own';
  if (scope === 'all' && user.role !== 'admin') {
    throw new ApiError(403, 'Admin privileges required to list all conversations', 'FORBIDDEN');
  }

  let conversationIds = null;
  if (scope !== 'all') {
    const participantRecords = await ConversationParticipant.findAll({
      attributes: ['conversation_id'],
      where: { user_id: user.id, left_at: null },
      raw: true,
    });
    conversationIds = Array.from(new Set(participantRecords.map((record) => record.conversation_id)));
    if (!conversationIds.length) {
      const emptyResponse = { data: [], meta: { nextCursor: null } };
      if (analyticsRequested(query.analytics)) {
        emptyResponse.analytics = { total: 0, total_unread: 0 };
      }
      return emptyResponse;
    }
  }

  if (query.participant_id) {
    const targetWhere = { user_id: query.participant_id, left_at: null };
    if (conversationIds) {
      targetWhere.conversation_id = { [Op.in]: conversationIds };
    }
    const other = await ConversationParticipant.findAll({
      attributes: ['conversation_id'],
      where: targetWhere,
      raw: true,
    });
    const otherSet = new Set(other.map((record) => record.conversation_id));
    const filtered = (conversationIds || Array.from(otherSet)).filter((id) => otherSet.has(id));
    conversationIds = filtered;
    if (!conversationIds.length) {
      const emptyResponse = { data: [], meta: { nextCursor: null } };
      if (analyticsRequested(query.analytics)) {
        emptyResponse.analytics = { total: 0, total_unread: 0 };
      }
      return emptyResponse;
    }
  }

  const includeDeleted = query.include === 'deleted' && user.role === 'admin';
  const pagination = buildPagination(query, ['updated_at', 'created_at', 'last_message_at']);
  const fields = normalizeFields(query.fields, ['id', pagination.sortField]);
  const expandSet = new Set((query.expand || []).map((item) => item.toLowerCase()));
  const participantsInclude = buildParticipantInclude();
  const include = [participantsInclude];

  const where = {};
  if (conversationIds && conversationIds.length) {
    where.id = { [Op.in]: conversationIds };
  }
  if (!includeDeleted) {
    where.deleted_at = null;
  }
  if (query.q) {
    const searchTerm = `%${String(query.q).trim()}%`;
    const operator = likeOperator();
    where[Op.and] = where[Op.and] || [];
    where[Op.and].push({
      [Op.or]: [
        { title: { [operator]: searchTerm } },
        { '$participants.user.email$': { [operator]: searchTerm } },
      ],
    });
  }
  if (pagination.cursorValue) {
    where[pagination.sortField] = { [pagination.cursorOperator]: pagination.cursorValue };
  }

  if (hasExpand(expandSet, 'last_message')) {
    const includeSender = expandSet.has('last_message.sender');
    include.push({
      model: Message,
      as: 'messages',
      separate: true,
      limit: 1,
      order: [['created_at', 'DESC']],
      attributes: ['id', 'conversation_id', 'sender_id', 'text', 'attachments', 'metadata', 'created_at', 'updated_at', 'edited_at'],
      include: includeSender
        ? [{ model: User, as: 'sender', attributes: ['id', 'email', 'role', 'active_role'] }]
        : [],
    });
  }

  const conversations = await Conversation.findAll({
    attributes: fields,
    where,
    include,
    order: pagination.order,
    limit: pagination.limit,
    paranoid: !includeDeleted,
    distinct: true,
    subQuery: false,
  });

  if (hasExpand(expandSet, 'last_message')) {
    conversations.forEach((conversation) => {
      const messages = conversation.get('messages');
      const lastMessage = Array.isArray(messages) && messages.length ? messages[0] : null;
      conversation.setDataValue('last_message', lastMessage || null);
      conversation.setDataValue('messages', undefined);
    });
  }

  const nextCursor =
    conversations.length === pagination.limit && conversations.length
      ? encodeCursor(conversations[conversations.length - 1][pagination.sortField])
      : null;

  const response = {
    data: conversations,
    meta: { nextCursor },
  };

  if (analyticsRequested(query.analytics)) {
    const analyticsInclude = [buildParticipantInclude()];
    const filterWhere = { ...where };
    delete filterWhere[pagination.sortField];
    const matchingRows = await Conversation.findAll({
      attributes: ['id'],
      where: filterWhere,
      include: analyticsInclude,
      paranoid: !includeDeleted,
      raw: true,
    });
    const matchingIds = Array.from(
      new Set(matchingRows.map((row) => row.id || row['Conversation.id']).filter(Boolean))
    );
    const totalUnread = matchingIds.length
      ? await ConversationParticipant.sum('unread_count', {
          where: { conversation_id: { [Op.in]: matchingIds }, user_id: user.id },
        })
      : 0;
    response.analytics = {
      total: matchingIds.length,
      total_unread: Number(totalUnread || 0),
    };
  }

  return response;
};

const createConversation = async (user, body) => {
  const uniqueParticipantIds = Array.from(new Set([...(body.participants || []), user.id]));
  if (uniqueParticipantIds.length < 2) {
    throw new ApiError(400, 'At least two participants are required', 'CONVERSATION_PARTICIPANTS_MIN');
  }

  const participants = await User.findAll({ where: { id: { [Op.in]: uniqueParticipantIds } } });
  if (participants.length !== uniqueParticipantIds.length) {
    throw new ApiError(404, 'One or more participants were not found', 'PARTICIPANT_NOT_FOUND');
  }

  const result = await sequelize.transaction(async (transaction) => {
    const conversation = await Conversation.create(
      {
        title: body.title || null,
        type: uniqueParticipantIds.length > 2 ? 'group' : 'direct',
        created_by: user.id,
        metadata: body.metadata || null,
      },
      { transaction }
    );

    await Promise.all(
      uniqueParticipantIds.map((participantId) =>
        ConversationParticipant.create(
          {
            conversation_id: conversation.id,
            user_id: participantId,
            role: participantId === user.id ? 'owner' : 'member',
            joined_at: new Date(),
          },
          { transaction }
        )
      )
    );

    const fullConversation = await Conversation.findByPk(conversation.id, {
      include: [
        {
          model: ConversationParticipant,
          as: 'participants',
          where: { left_at: null },
          required: false,
          include: [{ model: User, as: 'user', attributes: ['id', 'email', 'role', 'active_role'] }],
        },
      ],
      transaction,
    });

    return { fullConversation, participantIds: uniqueParticipantIds };
  });

  setImmediate(() => {
    emitToUsers(result.participantIds, 'conversation:created', { conversation: result.fullConversation });
  });

  return result.fullConversation;
};

const getConversation = async (user, id, options = {}) => {
  await resolveConversationAccess(id, user, { requireParticipant: user.role !== 'admin', includeDeleted: options.includeDeleted });
  const includeDeleted = options.includeDeleted && user.role === 'admin';
  const conversation = await fetchConversation(id, { includeDeleted });
  if (!conversation || (!includeDeleted && conversation.deleted_at)) {
    throw new ApiError(404, 'Conversation not found', 'CONVERSATION_NOT_FOUND');
  }

  if (options.expand?.includes('last_message')) {
    const lastMessage = await Message.findOne({
      where: { conversation_id: id },
      order: [['created_at', 'DESC']],
      include: [{ model: User, as: 'sender', attributes: ['id', 'email', 'role', 'active_role'] }],
    });
    conversation.setDataValue('last_message', lastMessage || null);
  }

  return conversation;
};

const updateConversation = async (user, id, body) => {
  const { participant } = await resolveConversationAccess(id, user);
  const conversation = await Conversation.findByPk(id);
  if (!conversation) {
    throw new ApiError(404, 'Conversation not found', 'CONVERSATION_NOT_FOUND');
  }

  const updates = [];

  if (Object.prototype.hasOwnProperty.call(body, 'title')) {
    if (conversation.created_by !== user.id && user.role !== 'admin') {
      throw new ApiError(403, 'Only the conversation owner can change the title', 'FORBIDDEN');
    }
    conversation.title = body.title;
    updates.push(conversation.save());
  }

  let participantTouched = false;
  if (Object.prototype.hasOwnProperty.call(body, 'pinned')) {
    participant.pinned = Boolean(body.pinned);
    participantTouched = true;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'archived')) {
    participant.archived = Boolean(body.archived);
    participantTouched = true;
  }

  if (participantTouched) {
    updates.push(participant.save());
  }

  await Promise.all(updates);

  const updated = await fetchConversation(id, {});
  if (body.pinned !== undefined || body.archived !== undefined || body.title !== undefined) {
    const participants = await ConversationParticipant.findAll({
      where: { conversation_id: id, left_at: null },
      attributes: ['user_id'],
    });
    const participantIds = participants.map((p) => p.user_id);
    setImmediate(() => {
      emitToConversation(id, 'conversation:updated', participantIds, { conversation: updated });
    });
  }

  return updated;
};

const deleteConversation = async (user, id) => {
  const conversation = await Conversation.findByPk(id);
  if (!conversation) {
    throw new ApiError(404, 'Conversation not found', 'CONVERSATION_NOT_FOUND');
  }
  if (conversation.created_by !== user.id && user.role !== 'admin') {
    await resolveConversationAccess(id, user);
    throw new ApiError(403, 'Only the owner or an admin can delete the conversation', 'FORBIDDEN');
  }

  await conversation.destroy();

  const participants = await ConversationParticipant.findAll({
    where: { conversation_id: id },
    attributes: ['user_id'],
  });
  const participantIds = participants.map((p) => p.user_id);
  setImmediate(() => {
    emitToConversation(id, 'conversation:deleted', participantIds, { conversation_id: id });
  });

  return { success: true };
};

const listMessages = async (user, conversationId, query = {}) => {
  await resolveConversationAccess(conversationId, user, { requireParticipant: user.role !== 'admin' });
  const pagination = buildPagination(query, ['created_at']);
  const fields = normalizeFields(query.fields, ['id', 'conversation_id', pagination.sortField]);
  const expandSet = new Set((query.expand || []).map((item) => item.toLowerCase()));
  const include = [];

  const senderInclude = {
    model: User,
    as: 'sender',
    attributes: ['id', 'email', 'role', 'active_role'],
  };
  include.push(senderInclude);

  if (hasExpand(expandSet, 'reads')) {
    const includeUser = expandSet.has('reads.user');
    include.push({
      model: MessageRead,
      as: 'reads',
      attributes: ['id', 'user_id', 'read_at', 'created_at', 'updated_at'],
      include: includeUser
        ? [{ model: User, as: 'user', attributes: ['id', 'email', 'role', 'active_role'] }]
        : [],
    });
  }

  const baseWhere = { conversation_id: conversationId };
  if (query.q) {
    const operator = likeOperator();
    const searchTerm = `%${String(query.q).trim()}%`;
    baseWhere[Op.or] = [{ text: { [operator]: searchTerm } }];
  }

  const where = { ...baseWhere };
  if (pagination.cursorValue) {
    where.created_at = { [pagination.cursorOperator]: pagination.cursorValue };
  }

  const messages = await Message.findAll({
    attributes: fields,
    where,
    include,
    order: pagination.order,
    limit: pagination.limit,
  });

  const nextCursor =
    messages.length === pagination.limit && messages.length
      ? encodeCursor(messages[messages.length - 1][pagination.sortField])
      : null;

  const response = { data: messages, meta: { nextCursor } };
  if (analyticsRequested(query.analytics)) {
    const totalMessages = await Message.count({ where: baseWhere });
    const unread = await ConversationParticipant.findOne({
      where: { conversation_id: conversationId, user_id: user.id },
    });
    response.analytics = {
      total: totalMessages,
      unread: unread ? unread.unread_count : 0,
    };
  }

  return response;
};

const createMessage = async (user, conversationId, body) => {
  const { participant } = await resolveConversationAccess(conversationId, user, { lock: undefined });
  const attachments = body.attachments || [];
  const text = body.text ? String(body.text).trim() : '';
  if (!text && (!attachments || !attachments.length)) {
    throw new ApiError(400, 'Message text or attachments are required', 'MESSAGE_CONTENT_REQUIRED');
  }

  const result = await sequelize.transaction(async (transaction) => {
    const message = await Message.create(
      {
        conversation_id: conversationId,
        sender_id: user.id,
        text: text || null,
        attachments,
        metadata: body.metadata || null,
      },
      { transaction }
    );

    await Conversation.update(
      { last_message_at: message.created_at },
      { where: { id: conversationId }, transaction }
    );

    participant.last_read_at = message.created_at;
    participant.last_read_message_id = message.id;
    participant.unread_count = 0;
    await participant.save({ transaction });

    await MessageRead.upsert(
      {
        message_id: message.id,
        user_id: user.id,
        read_at: message.created_at,
      },
      { transaction }
    );

    await ConversationParticipant.increment('unread_count', {
      by: 1,
      where: {
        conversation_id: conversationId,
        user_id: { [Op.ne]: user.id },
        left_at: null,
      },
      transaction,
    });

    const fullMessage = await Message.findByPk(message.id, {
      include: [{ model: User, as: 'sender', attributes: ['id', 'email', 'role', 'active_role'] }],
      transaction,
    });

    const participants = await ConversationParticipant.findAll({
      where: { conversation_id: conversationId, left_at: null },
      attributes: ['user_id'],
      transaction,
    });
    const participantIds = participants.map((p) => p.user_id);

    return { message: fullMessage, participantIds };
  });

  setImmediate(() => {
    emitToConversation(conversationId, 'message:new', result.participantIds, { message: result.message });
  });

  return result.message;
};

const findEditableMessage = async (id) => {
  const message = await Message.findByPk(id, {
    include: [{ model: Conversation, as: 'conversation' }],
  });
  if (!message) {
    throw new ApiError(404, 'Message not found', 'MESSAGE_NOT_FOUND');
  }
  return message;
};

const updateMessage = async (user, id, body) => {
  const message = await findEditableMessage(id);
  if (message.sender_id !== user.id && user.role !== 'admin') {
    throw new ApiError(403, 'Only the author or an admin can edit this message', 'FORBIDDEN');
  }
  if (user.role !== 'admin') {
    const diff = dayjs().diff(dayjs(message.created_at), 'minute');
    if (diff > EDIT_WINDOW_MINUTES) {
      throw new ApiError(403, 'Edit window has expired', 'MESSAGE_EDIT_WINDOW_EXPIRED');
    }
  }

  const attachments = body.attachments || [];
  const text = body.text ? String(body.text).trim() : '';
  if (!text && (!attachments || !attachments.length)) {
    throw new ApiError(400, 'Message text or attachments are required', 'MESSAGE_CONTENT_REQUIRED');
  }

  message.text = text || null;
  message.attachments = attachments;
  message.edited_at = new Date();
  if (Object.prototype.hasOwnProperty.call(body, 'metadata')) {
    message.metadata = body.metadata || null;
  }
  await message.save();

  const participants = await ConversationParticipant.findAll({
    where: { conversation_id: message.conversation_id, left_at: null },
    attributes: ['user_id'],
  });
  const participantIds = participants.map((p) => p.user_id);

  setImmediate(() => {
    emitToConversation(message.conversation_id, 'message:edit', participantIds, { message });
  });

  return message;
};

const deleteMessage = async (user, id) => {
  const message = await findEditableMessage(id);
  if (message.sender_id !== user.id && user.role !== 'admin') {
    throw new ApiError(403, 'Only the author or an admin can delete this message', 'FORBIDDEN');
  }
  await message.destroy();

  const participants = await ConversationParticipant.findAll({
    where: { conversation_id: message.conversation_id, left_at: null },
    attributes: ['user_id'],
  });
  const participantIds = participants.map((p) => p.user_id);
  setImmediate(() => {
    emitToConversation(message.conversation_id, 'message:deleted', participantIds, {
      message_id: id,
      conversation_id: message.conversation_id,
    });
  });

  return { success: true };
};

const markMessageRead = async (user, id) => {
  const message = await Message.findByPk(id);
  if (!message) {
    throw new ApiError(404, 'Message not found', 'MESSAGE_NOT_FOUND');
  }

  const { participant } = await resolveConversationAccess(message.conversation_id, user);

  return sequelize.transaction(async (transaction) => {
    await MessageRead.upsert(
      {
        message_id: message.id,
        user_id: user.id,
        read_at: new Date(),
      },
      { transaction }
    );

    participant.last_read_at = new Date();
    participant.last_read_message_id = message.id;

    const unread = await Message.count({
      where: {
        conversation_id: message.conversation_id,
        created_at: { [Op.gt]: message.created_at },
        sender_id: { [Op.ne]: user.id },
        deleted_at: null,
      },
      transaction,
    });
    participant.unread_count = unread;
    await participant.save({ transaction });

    const payload = {
      message_id: message.id,
      conversation_id: message.conversation_id,
      user_id: user.id,
      unread_count: unread,
    };

    const participants = await ConversationParticipant.findAll({
      where: { conversation_id: message.conversation_id, left_at: null },
      attributes: ['user_id'],
      transaction,
    });
    const participantIds = participants.map((p) => p.user_id);
    setImmediate(() => {
      emitToConversation(message.conversation_id, 'message:read', participantIds, payload);
    });

    return { success: true, unread_count: unread };
  });
};

const messageVolumeAnalytics = async (user, query = {}) => {
  const granularity = ['day', 'week', 'month'].includes(query.by) ? query.by : 'day';
  const scope = query.scope || 'user';

  const extraWhere = [];
  const replacements = {};

  if (scope === 'platform') {
    if (user.role !== 'admin') {
      throw new ApiError(403, 'Admin privileges required', 'FORBIDDEN');
    }
  } else if (scope === 'org') {
    const orgId = query.org_id || user.org_id;
    if (!orgId) {
      throw new ApiError(400, 'org_id is required for org scope', 'VALIDATION_ERROR');
    }
    if (user.role !== 'admin' && user.org_id !== orgId) {
      throw new ApiError(403, 'Forbidden for this organization', 'FORBIDDEN');
    }
    extraWhere.push('sender_id IN (SELECT id FROM users WHERE org_id = :orgId)');
    replacements.orgId = orgId;
  } else {
    const subjectId = query.user_id || user.id;
    if (!subjectId) {
      throw new ApiError(400, 'user_id is required', 'VALIDATION_ERROR');
    }
    if (user.role !== 'admin' && subjectId !== user.id) {
      throw new ApiError(403, 'Forbidden for this user', 'FORBIDDEN');
    }
    extraWhere.push('sender_id = :userId');
    replacements.userId = subjectId;
  }

  const buckets = await aggregateByPeriod(Message, 'created_at', {
    granularity,
    from: query.from,
    to: query.to,
    extraWhere,
    replacements,
  });

  return { buckets };
};

module.exports = {
  listConversations,
  createConversation,
  getConversation,
  updateConversation,
  deleteConversation,
  listMessages,
  createMessage,
  updateMessage,
  deleteMessage,
  markMessageRead,
  messageVolumeAnalytics,
};
