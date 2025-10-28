const { VerificationRequest } = require('../models');

const start = async (userId, body) => {
  const request = await VerificationRequest.create({
    subject_type: body.subject_type,
    subject_id: body.subject_id || userId,
    data: body.data,
  });
  return request;
};

const status = async ({ subject_type, subject_id }) => {
  const request = await VerificationRequest.findOne({ where: { subject_type, subject_id }, order: [['created_at', 'DESC']] });
  return request || { subject_type, subject_id, status: 'not_requested' };
};

const webhook = async (payload) => {
  return { received: true, payload };
};

module.exports = { start, status, webhook };
