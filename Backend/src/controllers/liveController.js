const Joi = require('joi');
const liveService = require('../services/liveService');
const { ApiError } = require('../middleware/errorHandler');

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) {
    throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', { errors: error.details });
  }
  return value;
};

const baseSignalFields = {
  session_id: Joi.string().uuid().required(),
  target_id: Joi.string().uuid().optional(),
  expires_in: Joi.number().integer().min(60).max(3600).optional(),
};

const offerSchema = Joi.object({
  ...baseSignalFields,
  sdp: Joi.string().min(10).required(),
});

const answerSchema = Joi.object({
  ...baseSignalFields,
  sdp: Joi.string().min(10).required(),
});

const iceSchema = Joi.object({
  ...baseSignalFields,
  candidate: Joi.string().required(),
  sdp_mid: Joi.string().optional(),
  sdp_mline_index: Joi.number().integer().min(0).optional(),
});

const createHandler = (type, schema, buildPayload) => async (req, res, next) => {
  try {
    const payload = validate(schema, req.body);
    const signalPayload = buildPayload(payload);
    const result = await liveService.createSignal(req.user, type, signalPayload);
    res.status(202).json(result);
  } catch (error) {
    next(error);
  }
};

const buildOfferPayload = (payload) => ({
  session_id: payload.session_id,
  target_id: payload.target_id,
  expires_in: payload.expires_in,
  payload: { type: 'offer', sdp: payload.sdp },
});

const buildAnswerPayload = (payload) => ({
  session_id: payload.session_id,
  target_id: payload.target_id,
  expires_in: payload.expires_in,
  payload: { type: 'answer', sdp: payload.sdp },
});

const buildIcePayload = (payload) => ({
  session_id: payload.session_id,
  target_id: payload.target_id,
  expires_in: payload.expires_in,
  payload: {
    type: 'ice',
    candidate: payload.candidate,
    sdp_mid: payload.sdp_mid,
    sdp_mline_index: payload.sdp_mline_index,
  },
});

module.exports = {
  offer: createHandler('offer', offerSchema, buildOfferPayload),
  answer: createHandler('answer', answerSchema, buildAnswerPayload),
  ice: createHandler('ice', iceSchema, buildIcePayload),
};
