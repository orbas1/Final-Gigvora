const { SupportTicket, SupportMessage } = require('../models');
const { buildPagination } = require('../utils/pagination');

const listTickets = async (query) => {
  const pagination = buildPagination(query);
  const where = {};
  if (query.status) where.status = query.status;
  const { rows, count } = await SupportTicket.findAndCountAll({
    where,
    include: [{ association: 'messages' }],
    limit: pagination.limit,
    order: pagination.order,
  });
  return { data: rows, total: count };
};

const createTicket = async (userId, body) => {
  const ticket = await SupportTicket.create({ user_id: userId, subject: body.subject, priority: body.priority, status: 'open' });
  if (body.message) {
    await SupportMessage.create({ ticket_id: ticket.id, user_id: userId, body: body.message });
  }
  return ticket;
};

const getTicket = (id) => SupportTicket.findByPk(id, { include: [{ association: 'messages' }] });

const addMessage = (userId, id, body) => SupportMessage.create({ ticket_id: id, user_id: userId, body: body.message });

const updateTicket = async (id, body) => {
  const ticket = await SupportTicket.findByPk(id);
  if (!ticket) throw new (require('../middleware/errorHandler').ApiError)(404, 'Ticket not found', 'TICKET_NOT_FOUND');
  await ticket.update(body);
  return ticket;
};

const slaAnalytics = async ({ from, to, by = 'day' }) => {
  return { from, to, by, avg_response_minutes: 10 };
};

module.exports = { listTickets, createTicket, getTicket, addMessage, updateTicket, slaAnalytics };
