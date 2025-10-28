const Joi = require('joi');
const gigService = require('../services/gigService');
const { ApiError } = require('../middleware/errorHandler');
const { persistIdempotentResponse } = require('../middleware/idempotency');

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', { errors: error.details });
  return value;
};

const listSchema = Joi.object({
  q: Joi.string(),
  seller_id: Joi.string().uuid(),
  status: Joi.string(),
  tags: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()),
  price_min: Joi.number(),
  price_max: Joi.number(),
  limit: Joi.number().integer().min(1),
  cursor: Joi.string(),
  sort: Joi.string(),
  analytics: Joi.string(),
  fields: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()),
  expand: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()),
  include: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()),
});

const packageSchema = Joi.object({
  tier: Joi.string().valid('basic', 'standard', 'premium').required(),
  name: Joi.string().required(),
  description: Joi.string().allow('', null),
  price: Joi.number().positive().required(),
  delivery_days: Joi.number().integer().positive().required(),
  revisions: Joi.number().integer().min(0).allow(null),
  features: Joi.array().items(Joi.object()).allow(null),
});

const packageUpdateSchema = Joi.object({
  name: Joi.string(),
  description: Joi.string().allow('', null),
  price: Joi.number().positive(),
  delivery_days: Joi.number().integer().positive(),
  revisions: Joi.number().integer().min(0).allow(null),
  features: Joi.array().items(Joi.object()).allow(null),
});

const gigSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().allow('', null),
  category: Joi.string().allow('', null),
  subcategory: Joi.string().allow('', null),
  status: Joi.string().valid('draft', 'active', 'paused'),
  price_min: Joi.number().positive().allow(null),
  price_max: Joi.number().positive().allow(null),
  currency: Joi.string().length(3),
  metadata: Joi.object().unknown(true),
  tags: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()),
  packages: Joi.array().items(packageSchema),
});

const gigUpdateSchema = gigSchema.fork(['title'], (schema) => schema.optional());

const addonSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().allow('', null),
  price: Joi.number().positive().required(),
  delivery_days: Joi.number().integer().min(0).allow(null),
  metadata: Joi.object().unknown(true),
});

const addonUpdateSchema = addonSchema.fork(['title', 'description', 'price', 'delivery_days', 'metadata'], (schema) =>
  schema.optional()
);

const faqSchema = Joi.object({
  question: Joi.string().required(),
  answer: Joi.string().required(),
  sort_order: Joi.number().integer().min(0).allow(null),
});

const faqUpdateSchema = faqSchema.fork(['question', 'answer', 'sort_order'], (schema) => schema.optional());

const mediaSchema = Joi.object({
  type: Joi.string().valid('image', 'video', 'document').default('image'),
  url: Joi.string().uri().required(),
  sort_order: Joi.number().integer().allow(null),
  metadata: Joi.object().unknown(true),
});

const orderSchema = Joi.object({
  package_tier: Joi.string().valid('basic', 'standard', 'premium').required(),
  price: Joi.number().positive().allow(null),
  requirements: Joi.string().allow('', null),
  notes: Joi.string().allow('', null),
});

const orderUpdateSchema = Joi.object({
  status: Joi.string().valid('pending', 'in_progress', 'delivered', 'completed', 'cancelled', 'disputed'),
  requirements: Joi.string().allow('', null),
  notes: Joi.string().allow('', null),
});

const cancelSchema = Joi.object({
  reason: Joi.string().allow('', null),
});

const submissionSchema = Joi.object({
  message: Joi.string().allow('', null),
  attachments: Joi.array().items(Joi.object()).allow(null),
  metadata: Joi.object().unknown(true),
});

const submissionUpdateSchema = Joi.object({
  message: Joi.string().allow('', null),
  attachments: Joi.array().items(Joi.object()).allow(null),
  status: Joi.string().valid('revision_requested', 'accepted'),
});

const reviewSchema = Joi.object({
  reviewee_id: Joi.string().uuid().required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().allow('', null),
  metadata: Joi.object().unknown(true),
});

const list = async (req, res, next) => {
  try {
    const payload = validate(listSchema, req.query);
    const result = await gigService.listGigs(payload, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const payload = validate(gigSchema, req.body);
    const result = await gigService.createGig(req.user.id, payload);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const get = async (req, res, next) => {
  try {
    const gig = await gigService.getGig(req.params.id, req.query, req.user);
    res.json(gig);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const payload = validate(gigUpdateSchema, req.body);
    const gig = await gigService.updateGig(req.params.id, req.user, payload);
    res.json(gig);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await gigService.deleteGig(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const listPackages = async (req, res, next) => {
  try {
    const packages = await gigService.listPackages(req.params.id, req.user);
    res.json({ data: packages });
  } catch (error) {
    next(error);
  }
};

const createPackages = async (req, res, next) => {
  try {
    const payload = validate(Joi.array().items(packageSchema).length(3), req.body);
    const packages = await gigService.createPackages(req.params.id, req.user, payload);
    res.status(201).json({ data: packages });
  } catch (error) {
    next(error);
  }
};

const updatePackage = async (req, res, next) => {
  try {
    const payload = validate(packageUpdateSchema, req.body);
    const pkg = await gigService.updatePackage(req.params.id, req.user, payload);
    res.json(pkg);
  } catch (error) {
    next(error);
  }
};

const deletePackage = async (req, res, next) => {
  try {
    const result = await gigService.deletePackage(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const listAddons = async (req, res, next) => {
  try {
    const addons = await gigService.listAddons(req.params.id, req.user);
    res.json({ data: addons });
  } catch (error) {
    next(error);
  }
};

const createAddon = async (req, res, next) => {
  try {
    const payload = validate(addonSchema, req.body);
    const addon = await gigService.createAddon(req.params.id, req.user, payload);
    res.status(201).json(addon);
  } catch (error) {
    next(error);
  }
};

const updateAddon = async (req, res, next) => {
  try {
    const payload = validate(addonUpdateSchema, req.body);
    const addon = await gigService.updateAddon(req.params.id, req.user, payload);
    res.json(addon);
  } catch (error) {
    next(error);
  }
};

const deleteAddon = async (req, res, next) => {
  try {
    const result = await gigService.deleteAddon(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const listFaq = async (req, res, next) => {
  try {
    const faq = await gigService.listFaq(req.params.id, req.user);
    res.json({ data: faq });
  } catch (error) {
    next(error);
  }
};

const createFaq = async (req, res, next) => {
  try {
    const payload = validate(faqSchema, req.body);
    const faq = await gigService.createFaq(req.params.id, req.user, payload);
    res.status(201).json(faq);
  } catch (error) {
    next(error);
  }
};

const updateFaq = async (req, res, next) => {
  try {
    const payload = validate(faqUpdateSchema, req.body);
    const faq = await gigService.updateFaq(req.params.id, req.user, payload);
    res.json(faq);
  } catch (error) {
    next(error);
  }
};

const deleteFaq = async (req, res, next) => {
  try {
    const result = await gigService.deleteFaq(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const addMedia = async (req, res, next) => {
  try {
    const payload = validate(mediaSchema, req.body);
    const media = await gigService.addMedia(req.params.id, req.user, payload);
    res.status(201).json(media);
  } catch (error) {
    next(error);
  }
};

const removeMedia = async (req, res, next) => {
  try {
    const result = await gigService.removeMedia(req.params.id, req.params.mediaId, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const listOrders = async (req, res, next) => {
  try {
    const orders = await gigService.listOrders(req.params.id, req.user);
    res.json({ data: orders });
  } catch (error) {
    next(error);
  }
};

const createOrder = async (req, res, next) => {
  try {
    const payload = validate(orderSchema, req.body);
    const order = await gigService.createOrder(req.params.id, req.user, payload);
    await persistIdempotentResponse(req, res, { status: 201, body: order });
    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
};

const getOrder = async (req, res, next) => {
  try {
    const order = await gigService.getOrder(req.params.id, req.user);
    res.json(order);
  } catch (error) {
    next(error);
  }
};

const updateOrder = async (req, res, next) => {
  try {
    const payload = validate(orderUpdateSchema, req.body);
    const order = await gigService.updateOrder(req.params.id, req.user, payload);
    res.json(order);
  } catch (error) {
    next(error);
  }
};

const cancelOrder = async (req, res, next) => {
  try {
    const payload = validate(cancelSchema, req.body);
    const order = await gigService.cancelOrder(req.params.id, req.user, payload);
    res.json(order);
  } catch (error) {
    next(error);
  }
};

const listSubmissions = async (req, res, next) => {
  try {
    const submissions = await gigService.listSubmissions(req.params.id, req.user);
    res.json({ data: submissions });
  } catch (error) {
    next(error);
  }
};

const createSubmission = async (req, res, next) => {
  try {
    const payload = validate(submissionSchema, req.body);
    const submission = await gigService.createSubmission(req.params.id, req.user, payload);
    await persistIdempotentResponse(req, res, { status: 201, body: submission });
    res.status(201).json(submission);
  } catch (error) {
    next(error);
  }
};

const updateSubmission = async (req, res, next) => {
  try {
    const payload = validate(submissionUpdateSchema, req.body);
    const submission = await gigService.updateSubmission(req.params.id, req.user, payload);
    res.json(submission);
  } catch (error) {
    next(error);
  }
};

const listReviews = async (req, res, next) => {
  try {
    const reviews = await gigService.listOrderReviews(req.params.id, req.user);
    res.json({ data: reviews });
  } catch (error) {
    next(error);
  }
};

const createReview = async (req, res, next) => {
  try {
    const payload = validate(reviewSchema, req.body);
    const review = await gigService.createOrderReview(req.params.id, req.user, payload);
    res.status(201).json(review);
  } catch (error) {
    next(error);
  }
};

const gigAnalytics = async (req, res, next) => {
  try {
    const analytics = await gigService.gigAnalytics(req.params.id, req.user);
    res.json(analytics);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  list,
  create,
  get,
  update,
  remove,
  listPackages,
  createPackages,
  updatePackage,
  deletePackage,
  listAddons,
  createAddon,
  updateAddon,
  deleteAddon,
  listFaq,
  createFaq,
  updateFaq,
  deleteFaq,
  addMedia,
  removeMedia,
  listOrders,
  createOrder,
  getOrder,
  updateOrder,
  cancelOrder,
  listSubmissions,
  createSubmission,
  updateSubmission,
  listReviews,
  createReview,
  gigAnalytics,
};
