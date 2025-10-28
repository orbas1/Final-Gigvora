const {
  User,
  Profile,
  Dispute,
  DisputeMessage,
  DisputeEvidence,
  DisputeSettlement,
  DisputeDecision,
} = require('../models');

const overview = async ({ from, to }) => {
  const totalUsers = await User.count();
  return { totalUsers, from, to };
};

const listUsers = async () => User.findAll({ limit: 100 });

const restore = async ({ entity_type, id }) => {
  if (entity_type === 'user') {
    await User.restore({ where: { id } });
  }
  if (entity_type === 'profile') {
    await Profile.restore({ where: { id } });
  }
  if (entity_type === 'dispute') {
    await Dispute.restore({ where: { id } });
  }
  if (entity_type === 'dispute_message') {
    await DisputeMessage.restore({ where: { id } });
  }
  if (entity_type === 'dispute_evidence') {
    await DisputeEvidence.restore({ where: { id } });
  }
  if (entity_type === 'dispute_settlement') {
    await DisputeSettlement.restore({ where: { id } });
  }
  if (entity_type === 'dispute_decision') {
    await DisputeDecision.restore({ where: { id } });
  }
  return { success: true };
};

module.exports = { overview, listUsers, restore };
