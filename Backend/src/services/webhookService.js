const { WebhookSubscription } = require('../models');

const list = () => WebhookSubscription.findAll();
const create = (body) => WebhookSubscription.create(body);
const remove = (id) => WebhookSubscription.destroy({ where: { id } });
const deliveries = async ({ status, cursor }) => [];

module.exports = { list, create, remove, deliveries };
