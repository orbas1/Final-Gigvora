const Joi = require('joi');
const gigService = require('../services/gigService');
const { persistIdempotentResponse } = require('../middleware/idempotency');

const listSchema = Joi.object({
  q: Joi.string().allow(''),
  seller_id: Joi.string().uuid(),
  status: Joi.string(),
  tags: Joi.string(),
  price_min: Joi.number().min(0),
  price_max: Joi.number().min(0),
  cursor: Joi.string(),
  limit: Joi.number().integer().min(1).max(100),
  sort: Joi.string(),
  expand: Joi.string(),
  analytics: Joi.boolean().truthy('true').falsy('false'),
  include: Joi.string(),
});

const gigSchema = Joi.object({
  title: Joi.string().min(3).max(255).required(),
  description: Joi.string().allow(''),
  category: Joi.string().allow(''),
  subcategory: Joi.string().allow(''),
  status: Joi.string().valid('draft', 'active', 'paused', 'archived'),
  price_min: Joi.number().min(0).allow(null),
  price_max: Joi.number().min(0).allow(null),
  currency: Joi.string().length(3).uppercase(),
  delivery_time_days: Joi.number().integer().min(1).allow(null),
  metadata: Joi.object(),
  tags: Joi.array().items(Joi.string().trim().min(1)),
  packages: Joi.array().items(
    Joi.object({
      tier: Joi.string().valid('basic', 'standard', 'premium').required(),
      name: Joi.string().min(3).max(255).required(),
      description: Joi.string().allow(''),
      price: Joi.number().min(0).required(),
      currency: Joi.string().length(3).uppercase().allow(null),
      delivery_days: Joi.number().integer().min(1).required(),
      revisions: Joi.number().integer().min(0).allow(null),
      features: Joi.array().items(Joi.string().allow('')).allow(null),
      is_active: Joi.boolean().allow(null),
    })
  ),
});

const updateSchema = gigSchema.fork(['title', 'packages'], (schema) => schema.optional());

const packageSchema = Joi.object({
  id: Joi.string().uuid().allow(null),
  tier: Joi.string().valid('basic', 'standard', 'premium').required(),
  name: Joi.string().min(3).max(255).required(),
  description: Joi.string().allow(''),
  price: Joi.number().min(0).required(),
  currency: Joi.string().length(3).uppercase().allow(null),
  delivery_days: Joi.number().integer().min(1).required(),
  revisions: Joi.number().integer().min(0).allow(null),
  features: Joi.array().items(Joi.string().allow('')).allow(null),
  is_active: Joi.boolean().allow(null),
});

const packageUpdateSchema = packageSchema.fork(['tier', 'name', 'price', 'delivery_days'], (schema) => schema.optional());

const addonSchema = Joi.object({
  title: Joi.string().min(3).max(255).required(),
  description: Joi.string().allow(''),
  price: Joi.number().min(0).required(),
  currency: Joi.string().length(3).uppercase().allow(null),
  delivery_days: Joi.number().integer().min(0).allow(null),
  is_active: Joi.boolean().allow(null),
});

const faqSchema = Joi.object({
  question: Joi.string().min(3).max(255).required(),
  answer: Joi.string().min(3).required(),
  order_index: Joi.number().integer().min(1).allow(null),
});

const mediaSchema = Joi.object({
  media_type: Joi.string().valid('image', 'video', 'pdf').required(),
  url: Joi.string().uri().required(),
  thumbnail_url: Joi.string().uri().allow(null),
  order_index: Joi.number().integer().min(1).allow(null),
  metadata: Joi.object(),
});

const orderSchema = Joi.object({
  package_tier: Joi.string().valid('basic', 'standard', 'premium').required(),
  price: Joi.number().min(0).allow(null),
  currency: Joi.string().length(3).uppercase().allow(null),
  requirements: Joi.object().unknown(true),
  started_at: Joi.date().allow(null),
  due_at: Joi.date().allow(null),
});

const orderUpdateSchema = Joi.object({
  status: Joi.string().valid('requirements', 'in_progress', 'delivered', 'accepted', 'cancelled', 'refunded'),
  requirements: Joi.object().unknown(true),
  started_at: Joi.date().allow(null),
  due_at: Joi.date().allow(null),
  delivered_at: Joi.date().allow(null),
  accepted_at: Joi.date().allow(null),
  cancellation_reason: Joi.string().allow(''),
});

const submissionSchema = Joi.object({
  message: Joi.string().allow(''),
  attachments: Joi.array().items(
    Joi.object({ name: Joi.string().required(), url: Joi.string().uri().required() })
  ),
  status: Joi.string().valid('submitted', 'revision_requested', 'resubmitted', 'accepted'),
  revision_notes: Joi.string().allow(''),
});

const reviewSchema = Joi.object({
  reviewee_id: Joi.string().uuid().allow(null),
  rating: Joi.number().integer().min(1).max(5).required(),
  communication_rating: Joi.number().integer().min(1).max(5).allow(null),
  quality_rating: Joi.number().integer().min(1).max(5).allow(null),
  value_rating: Joi.number().integer().min(1).max(5).allow(null),
  comment: Joi.string().allow(''),
});

const analyticsSchema = Joi.object({
  from: Joi.date().allow(null),
  to: Joi.date().allow(null),
});

const listGigs = async (req, res, next) => {
  try {
    const query = await listSchema.validateAsync(req.query, { abortEarly: false, stripUnknown: true });
    const result = await gigService.listGigs(req.user, query);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const createGig = async (req, res, next) => {
  try {
    const payload = await gigSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const gig = await gigService.createGig(req.user, payload);
    const response = { status: 201, body: gig };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const getGig = async (req, res, next) => {
  try {
    const expand = req.query.expand ? req.query.expand.split(',').map((item) => item.trim()).filter(Boolean) : [];
    const includeDeleted = req.query.include === 'deleted' && req.user?.role === 'admin';
    const gig = await gigService.getGig(req.params.id, req.user, { expand, includeDeleted });
    res.json(gig);
  } catch (error) {
    next(error);
  }
};

const updateGig = async (req, res, next) => {
  try {
    const payload = await updateSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const gig = await gigService.updateGig(req.params.id, req.user, payload);
    const response = { status: 200, body: gig };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const deleteGig = async (req, res, next) => {
  try {
    const result = await gigService.deleteGig(req.params.id, req.user);
    const response = { status: 200, body: result };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
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

const createPackage = async (req, res, next) => {
  try {
    const payload = await packageSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const pkg = await gigService.upsertPackage(req.params.id, req.user, payload);
    const response = { status: 201, body: pkg };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const updatePackage = async (req, res, next) => {
  try {
    const payload = await packageUpdateSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const pkg = await gigService.updatePackage(req.params.packageId, req.user, payload);
    const response = { status: 200, body: pkg };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const deletePackage = async (req, res, next) => {
  try {
    const result = await gigService.deletePackage(req.params.packageId, req.user);
    const response = { status: 200, body: result };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
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
    const payload = await addonSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const addon = await gigService.createAddon(req.params.id, req.user, payload);
    const response = { status: 201, body: addon };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const updateAddon = async (req, res, next) => {
  try {
    const payload = await addonSchema.fork(['title'], (schema) => schema.optional()).validateAsync(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    const addon = await gigService.updateAddon(req.params.addonId, req.user, payload);
    const response = { status: 200, body: addon };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const deleteAddon = async (req, res, next) => {
  try {
    const result = await gigService.deleteAddon(req.params.addonId, req.user);
    const response = { status: 200, body: result };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const listFaqs = async (req, res, next) => {
  try {
    const faqs = await gigService.listFaqs(req.params.id, req.user);
    res.json({ data: faqs });
  } catch (error) {
    next(error);
  }
};

const createFaq = async (req, res, next) => {
  try {
    const payload = await faqSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const faq = await gigService.createFaq(req.params.id, req.user, payload);
    const response = { status: 201, body: faq };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const updateFaq = async (req, res, next) => {
  try {
    const payload = await faqSchema.fork(['question', 'answer'], (schema) => schema.optional()).validateAsync(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    const faq = await gigService.updateFaq(req.params.faqId, req.user, payload);
    const response = { status: 200, body: faq };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const deleteFaq = async (req, res, next) => {
  try {
    const result = await gigService.deleteFaq(req.params.faqId, req.user);
    const response = { status: 200, body: result };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const addMedia = async (req, res, next) => {
  try {
    const payload = await mediaSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const media = await gigService.addMedia(req.params.id, req.user, payload);
    const response = { status: 201, body: media };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const removeMedia = async (req, res, next) => {
  try {
    const result = await gigService.removeMedia(req.params.id, req.params.mediaId, req.user);
    const response = { status: 200, body: result };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
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
    const payload = await orderSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const order = await gigService.createOrder(req.params.id, req.user, payload);
    const response = { status: 201, body: order };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const getOrder = async (req, res, next) => {
  try {
    const order = await gigService.getOrder(req.params.orderId, req.user);
    res.json(order);
  } catch (error) {
    next(error);
  }
};

const updateOrder = async (req, res, next) => {
  try {
    const payload = await orderUpdateSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const order = await gigService.updateOrder(req.params.orderId, req.user, payload);
    const response = { status: 200, body: order };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const cancelOrder = async (req, res, next) => {
  try {
    const schema = Joi.object({ reason: Joi.string().allow('') });
    const payload = await schema.validateAsync(req.body || {}, { abortEarly: false, stripUnknown: true });
    const order = await gigService.cancelOrder(req.params.orderId, req.user, payload.reason);
    const response = { status: 200, body: order };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const listSubmissions = async (req, res, next) => {
  try {
    const submissions = await gigService.listSubmissions(req.params.orderId, req.user);
    res.json({ data: submissions });
  } catch (error) {
    next(error);
  }
};

const createSubmission = async (req, res, next) => {
  try {
    const payload = await submissionSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const submission = await gigService.createSubmission(req.params.orderId, req.user, payload);
    const response = { status: 201, body: submission };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const updateSubmission = async (req, res, next) => {
  try {
    const payload = await submissionSchema.fork(['message'], (schema) => schema.optional()).validateAsync(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    const submission = await gigService.updateSubmission(req.params.submissionId, req.user, payload);
    const response = { status: 200, body: submission };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const listOrderReviews = async (req, res, next) => {
  try {
    const reviews = await gigService.listOrderReviews(req.params.orderId, req.user);
    res.json({ data: reviews });
  } catch (error) {
    next(error);
  }
};

const createOrderReview = async (req, res, next) => {
  try {
    const payload = await reviewSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const review = await gigService.createOrderReview(req.params.orderId, req.user, payload);
    const response = { status: 201, body: review };
    await persistIdempotentResponse(req, res, response);
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

const salesAnalytics = async (req, res, next) => {
  try {
    const query = await analyticsSchema.validateAsync(req.query, { abortEarly: false, stripUnknown: true });
    const analytics = await gigService.getSalesAnalytics(query);
    res.json({ data: analytics });
  } catch (error) {
    next(error);
  }
};

const gigAnalytics = async (req, res, next) => {
  try {
    const analytics = await gigService.getGigAnalytics(req.params.id);
    res.json(analytics);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listGigs,
  createGig,
  getGig,
  updateGig,
  deleteGig,
  listPackages,
  createPackage,
  updatePackage,
  deletePackage,
  listAddons,
  createAddon,
  updateAddon,
  deleteAddon,
  listFaqs,
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
  listOrderReviews,
  createOrderReview,
  salesAnalytics,
  gigAnalytics,
};
