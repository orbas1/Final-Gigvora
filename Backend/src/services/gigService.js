const { Op, fn, col } = require('sequelize');
const {
  Gig,
  GigPackage,
  GigAddon,
  GigFaq,
  GigMedia,
  GigOrder,
  OrderSubmission,
  OrderReview,
  Tag,
  User,
  sequelize,
} = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { buildPagination, encodeCursor } = require('../utils/pagination');

const isUuid = (value) => /^[0-9a-fA-F-]{36}$/.test(String(value));

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const resolveTags = async (tags) => {
  if (!tags || !tags.length) return [];
  const tagRecords = [];
  for (const tag of tags) {
    if (isUuid(tag)) {
      const existing = await Tag.findByPk(tag);
      if (existing) tagRecords.push(existing);
    } else {
      const [record] = await Tag.findOrCreate({ where: { name: tag }, defaults: { description: null } });
      tagRecords.push(record);
    }
  }
  return tagRecords;
};

const buildGigIncludes = (expand) => {
  const include = [];
  if (expand.has('seller')) {
    include.push({ model: User, as: 'seller', attributes: ['id', 'email'] });
  }
  if (expand.has('packages')) {
    include.push({ model: GigPackage, as: 'packages', order: [['tier', 'ASC']] });
  }
  if (expand.has('addons')) {
    include.push({ model: GigAddon, as: 'addons', paranoid: false });
  }
  if (expand.has('faq')) {
    include.push({ model: GigFaq, as: 'faq', paranoid: false, order: [['sort_order', 'ASC']] });
  }
  if (expand.has('media')) {
    include.push({ model: GigMedia, as: 'media', order: [['sort_order', 'ASC']] });
  }
  if (expand.has('tags')) {
    include.push({ model: Tag, as: 'tags' });
  }
  if (expand.has('analytics')) {
    include.push({ model: GigOrder, as: 'orders' });
  }
  return include;
};

const buildGigWhere = (query) => {
  const where = {};
  if (query.seller_id) where.seller_id = query.seller_id;
  if (query.status) where.status = query.status;
  if (query.q) {
    const term = `%${query.q.toLowerCase()}%`;
    where[Op.or] = [
      sequelize.where(fn('lower', col('Gig.title')), { [Op.like]: term }),
      sequelize.where(fn('lower', col('Gig.description')), { [Op.like]: term }),
    ];
  }
  if (query.price_min) {
    where.price_min = { [Op.gte]: Number(query.price_min) };
  }
  if (query.price_max) {
    where.price_max = where.price_max || {};
    where.price_max[Op.lte] = Number(query.price_max);
  }
  return where;
};

const listGigs = async (query, currentUser) => {
  const pagination = buildPagination(query, ['created_at', 'updated_at']);
  const expand = new Set(toArray(query.expand));
  const fields = toArray(query.fields);
  const includeDeleted = currentUser?.role === 'admin' && toArray(query.include).includes('deleted');
  const tagFilters = toArray(query.tags);

  const where = buildGigWhere(query);
  if (pagination.cursorValue !== undefined) {
    where[pagination.sortField] = {
      ...(where[pagination.sortField] || {}),
      [pagination.cursorOperator]: pagination.cursorValue,
    };
  }

  const include = buildGigIncludes(expand);
  if (tagFilters.length) {
    include.push({
      model: Tag,
      as: 'tags',
      required: true,
      where: { name: { [Op.in]: tagFilters } },
      through: { attributes: [] },
    });
  }

  const attributes = fields.length
    ? Array.from(new Set([...fields, 'id', pagination.sortField]))
    : undefined;

  const { rows, count } = await Gig.findAndCountAll({
    where,
    include,
    attributes,
    paranoid: !includeDeleted,
    limit: pagination.limit + 1,
    order: pagination.order,
    distinct: true,
  });

  const hasMore = rows.length > pagination.limit;
  const dataRows = hasMore ? rows.slice(0, pagination.limit) : rows;
  const data = dataRows.map((row) => row.toJSON());
  const nextCursorValue = hasMore ? dataRows[dataRows.length - 1][pagination.sortField] : undefined;
  const nextCursor = hasMore ? encodeCursor(nextCursorValue) : null;

  let analytics;
  if (query.analytics === 'true') {
    const [total, active, paused] = await Promise.all([
      Gig.count(),
      Gig.count({ where: { status: 'active' } }),
      Gig.count({ where: { status: 'paused' } }),
    ]);
    analytics = {
      total_gigs: total,
      active_gigs: active,
      paused_gigs: paused,
    };
  }

  return {
    data,
    total: typeof count === 'number' ? count : data.length,
    page: { next_cursor: nextCursor, limit: pagination.limit },
    analytics,
  };
};

const createGig = async (sellerId, body) => {
  return sequelize.transaction(async (transaction) => {
    const gig = await Gig.create(
      {
        seller_id: sellerId,
        title: body.title,
        description: body.description,
        category: body.category,
        subcategory: body.subcategory,
        status: body.status || 'draft',
        price_min: body.price_min,
        price_max: body.price_max,
        currency: body.currency || 'USD',
        metadata: body.metadata,
      },
      { transaction }
    );

    if (body.tags) {
      const tags = await resolveTags(toArray(body.tags));
      await gig.setTags(tags, { transaction });
    }

    if (Array.isArray(body.packages) && body.packages.length) {
      await ensurePackagePayload(body.packages);
      for (const pkg of body.packages) {
        await GigPackage.create(
          {
            gig_id: gig.id,
            tier: pkg.tier,
            name: pkg.name,
            description: pkg.description,
            price: pkg.price,
            delivery_days: pkg.delivery_days,
            revisions: pkg.revisions,
            features: pkg.features,
          },
          { transaction }
        );
      }
    }

    return gig.reload({ include: [{ model: GigPackage, as: 'packages' }, { model: Tag, as: 'tags' }] });
  });
};

const ensureGigOwner = (gig, user) => {
  if (!user) throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  if (gig.seller_id !== user.id && user.role !== 'admin') {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }
};

const ensurePackagePayload = async (packages) => {
  const tiers = new Set();
  for (const pkg of packages) {
    if (!pkg.tier || !['basic', 'standard', 'premium'].includes(pkg.tier)) {
      throw new ApiError(400, 'Each package requires a valid tier', 'INVALID_PACKAGE');
    }
    if (tiers.has(pkg.tier)) {
      throw new ApiError(400, 'Duplicate package tier detected', 'INVALID_PACKAGE');
    }
    tiers.add(pkg.tier);
  }
  if (tiers.size !== 3) {
    throw new ApiError(400, 'Exactly three package tiers are required', 'INVALID_PACKAGE');
  }
};

const getGig = async (id, query, currentUser) => {
  const expand = new Set(toArray(query?.expand));
  const includeDeleted = currentUser?.role === 'admin' && toArray(query?.include).includes('deleted');
  const gig = await Gig.findByPk(id, { include: buildGigIncludes(expand), paranoid: !includeDeleted });
  if (!gig) throw new ApiError(404, 'Gig not found', 'GIG_NOT_FOUND');
  return gig;
};

const updateGig = async (id, user, body) => {
  const gig = await Gig.findByPk(id, { include: [{ model: Tag, as: 'tags' }] });
  if (!gig) throw new ApiError(404, 'Gig not found', 'GIG_NOT_FOUND');
  ensureGigOwner(gig, user);
  const editable = [
    'title',
    'description',
    'category',
    'subcategory',
    'status',
    'price_min',
    'price_max',
    'currency',
    'metadata',
  ];
  for (const field of editable) {
    if (body[field] !== undefined) gig[field] = body[field];
  }
  await gig.save();

  if (body.tags) {
    const tags = await resolveTags(toArray(body.tags));
    await gig.setTags(tags);
  }

  return gig.reload({ include: [{ model: Tag, as: 'tags' }] });
};

const deleteGig = async (id, user) => {
  const gig = await Gig.findByPk(id);
  if (!gig) throw new ApiError(404, 'Gig not found', 'GIG_NOT_FOUND');
  ensureGigOwner(gig, user);
  await gig.destroy();
  return { success: true };
};

const listPackages = async (gigId, user) => {
  const gig = await Gig.findByPk(gigId);
  if (!gig) throw new ApiError(404, 'Gig not found', 'GIG_NOT_FOUND');
  ensureGigOwner(gig, user);
  return GigPackage.findAll({ where: { gig_id: gigId }, order: [['tier', 'ASC']] });
};

const createPackages = async (gigId, user, packages) => {
  const gig = await Gig.findByPk(gigId, { include: [{ model: GigPackage, as: 'packages' }] });
  if (!gig) throw new ApiError(404, 'Gig not found', 'GIG_NOT_FOUND');
  ensureGigOwner(gig, user);
  if (gig.packages?.length) {
    throw new ApiError(409, 'Packages already exist; update existing packages instead', 'PACKAGES_EXIST');
  }
  await ensurePackagePayload(packages);
  return sequelize.transaction(async (transaction) => {
    const created = [];
    for (const pkg of packages) {
      const record = await GigPackage.create(
        {
          gig_id: gigId,
          tier: pkg.tier,
          name: pkg.name,
          description: pkg.description,
          price: pkg.price,
          delivery_days: pkg.delivery_days,
          revisions: pkg.revisions,
          features: pkg.features,
        },
        { transaction }
      );
      created.push(record);
    }
    return created;
  });
};

const updatePackage = async (packageId, user, body) => {
  const pkg = await GigPackage.findByPk(packageId, { include: [{ model: Gig, as: 'gig' }] });
  if (!pkg) throw new ApiError(404, 'Package not found', 'PACKAGE_NOT_FOUND');
  ensureGigOwner(pkg.gig, user);
  const editable = ['name', 'description', 'price', 'delivery_days', 'revisions', 'features'];
  for (const field of editable) {
    if (body[field] !== undefined) pkg[field] = body[field];
  }
  await pkg.save();
  return pkg;
};

const deletePackage = async (packageId, user) => {
  const pkg = await GigPackage.findByPk(packageId, { include: [{ model: Gig, as: 'gig', include: [{ model: GigPackage, as: 'packages' }] }] });
  if (!pkg) throw new ApiError(404, 'Package not found', 'PACKAGE_NOT_FOUND');
  ensureGigOwner(pkg.gig, user);
  if (pkg.gig.packages.length <= 3) {
    throw new ApiError(400, 'Maintain three package tiers; update instead of deleting', 'INVALID_PACKAGE');
  }
  await pkg.destroy();
  return { success: true };
};

const listAddons = async (gigId, user) => {
  const gig = await Gig.findByPk(gigId);
  if (!gig) throw new ApiError(404, 'Gig not found', 'GIG_NOT_FOUND');
  ensureGigOwner(gig, user);
  return GigAddon.findAll({ where: { gig_id: gigId }, paranoid: false });
};

const createAddon = async (gigId, user, body) => {
  const gig = await Gig.findByPk(gigId);
  if (!gig) throw new ApiError(404, 'Gig not found', 'GIG_NOT_FOUND');
  ensureGigOwner(gig, user);
  return GigAddon.create({
    gig_id: gigId,
    title: body.title,
    description: body.description,
    price: body.price,
    delivery_days: body.delivery_days,
    metadata: body.metadata,
  });
};

const updateAddon = async (addonId, user, body) => {
  const addon = await GigAddon.findByPk(addonId, { include: [{ model: Gig, as: 'gig' }] });
  if (!addon) throw new ApiError(404, 'Addon not found', 'ADDON_NOT_FOUND');
  ensureGigOwner(addon.gig, user);
  const editable = ['title', 'description', 'price', 'delivery_days', 'metadata'];
  for (const field of editable) {
    if (body[field] !== undefined) addon[field] = body[field];
  }
  await addon.save();
  return addon;
};

const deleteAddon = async (addonId, user) => {
  const addon = await GigAddon.findByPk(addonId, { include: [{ model: Gig, as: 'gig' }] });
  if (!addon) throw new ApiError(404, 'Addon not found', 'ADDON_NOT_FOUND');
  ensureGigOwner(addon.gig, user);
  await addon.destroy();
  return { success: true };
};

const listFaq = async (gigId, user) => {
  const gig = await Gig.findByPk(gigId);
  if (!gig) throw new ApiError(404, 'Gig not found', 'GIG_NOT_FOUND');
  ensureGigOwner(gig, user);
  return GigFaq.findAll({ where: { gig_id: gigId }, order: [['sort_order', 'ASC']], paranoid: false });
};

const createFaq = async (gigId, user, body) => {
  const gig = await Gig.findByPk(gigId);
  if (!gig) throw new ApiError(404, 'Gig not found', 'GIG_NOT_FOUND');
  ensureGigOwner(gig, user);
  return GigFaq.create({
    gig_id: gigId,
    question: body.question,
    answer: body.answer,
    sort_order: body.sort_order,
  });
};

const updateFaq = async (faqId, user, body) => {
  const faq = await GigFaq.findByPk(faqId, { include: [{ model: Gig, as: 'gig' }] });
  if (!faq) throw new ApiError(404, 'FAQ not found', 'FAQ_NOT_FOUND');
  ensureGigOwner(faq.gig, user);
  const editable = ['question', 'answer', 'sort_order'];
  for (const field of editable) {
    if (body[field] !== undefined) faq[field] = body[field];
  }
  await faq.save();
  return faq;
};

const deleteFaq = async (faqId, user) => {
  const faq = await GigFaq.findByPk(faqId, { include: [{ model: Gig, as: 'gig' }] });
  if (!faq) throw new ApiError(404, 'FAQ not found', 'FAQ_NOT_FOUND');
  ensureGigOwner(faq.gig, user);
  await faq.destroy();
  return { success: true };
};

const addMedia = async (gigId, user, body) => {
  const gig = await Gig.findByPk(gigId);
  if (!gig) throw new ApiError(404, 'Gig not found', 'GIG_NOT_FOUND');
  ensureGigOwner(gig, user);
  return GigMedia.create({
    gig_id: gigId,
    type: body.type || 'image',
    url: body.url,
    sort_order: body.sort_order,
    metadata: body.metadata,
  });
};

const removeMedia = async (gigId, mediaId, user) => {
  const media = await GigMedia.findByPk(mediaId, { include: [{ model: Gig, as: 'gig' }] });
  if (!media || media.gig_id !== gigId) throw new ApiError(404, 'Media not found', 'MEDIA_NOT_FOUND');
  ensureGigOwner(media.gig, user);
  await media.destroy();
  return { success: true };
};

const assertOrderActor = (order, user) => {
  if (order.buyer_id !== user.id && order.seller_id !== user.id && user.role !== 'admin') {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }
};

const listOrders = async (gigId, user) => {
  const gig = await Gig.findByPk(gigId);
  if (!gig) throw new ApiError(404, 'Gig not found', 'GIG_NOT_FOUND');
  ensureGigOwner(gig, user);
  return GigOrder.findAll({
    where: { gig_id: gigId },
    include: [
      { model: User, as: 'buyer', attributes: ['id', 'email'] },
      { model: User, as: 'seller', attributes: ['id', 'email'] },
    ],
    paranoid: false,
  });
};

const createOrder = async (gigId, user, body) => {
  const gig = await Gig.findByPk(gigId, { include: [{ model: GigPackage, as: 'packages' }] });
  if (!gig || gig.status !== 'active') {
    throw new ApiError(400, 'Gig not available for ordering', 'GIG_NOT_AVAILABLE');
  }
  if (gig.seller_id === user.id) {
    throw new ApiError(400, 'Sellers cannot order their own gig', 'INVALID_ORDER');
  }
  const pkg = gig.packages.find((p) => p.tier === body.package_tier);
  if (!pkg) {
    throw new ApiError(400, 'Selected package tier is not available', 'INVALID_PACKAGE');
  }
  const order = await GigOrder.create({
    gig_id: gigId,
    buyer_id: user.id,
    seller_id: gig.seller_id,
    package_tier: body.package_tier,
    price: body.price || pkg.price,
    currency: gig.currency || pkg.currency || 'USD',
    status: 'pending',
    requirements: body.requirements,
    notes: body.notes,
  });
  return order;
};

const getOrder = async (orderId, user) => {
  const order = await GigOrder.findByPk(orderId, {
    include: [
      { model: Gig, as: 'gig', include: [{ model: User, as: 'seller', attributes: ['id', 'email'] }] },
      { model: User, as: 'buyer', attributes: ['id', 'email'] },
      { model: User, as: 'seller', attributes: ['id', 'email'] },
      { model: OrderSubmission, as: 'submissions' },
    ],
    paranoid: false,
  });
  if (!order) throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
  assertOrderActor(order, user);
  return order;
};

const updateOrder = async (orderId, user, body) => {
  const order = await GigOrder.findByPk(orderId, { include: [{ model: Gig, as: 'gig' }] });
  if (!order) throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
  assertOrderActor(order, user);
  const isSeller = order.seller_id === user.id || user.role === 'admin';
  const isBuyer = order.buyer_id === user.id || user.role === 'admin';

  if (body.status) {
    const allowedStatuses = ['pending', 'in_progress', 'delivered', 'completed', 'cancelled', 'disputed'];
    if (!allowedStatuses.includes(body.status)) {
      throw new ApiError(400, 'Invalid order status', 'INVALID_STATUS');
    }
    if (['in_progress', 'delivered'].includes(body.status) && !isSeller) {
      throw new ApiError(403, 'Only sellers can update to this status', 'FORBIDDEN');
    }
    if (body.status === 'completed' && !isBuyer) {
      throw new ApiError(403, 'Only buyers can mark orders completed', 'FORBIDDEN');
    }
    order.status = body.status;
    if (body.status === 'in_progress') order.started_at = new Date();
    if (body.status === 'delivered') order.delivered_at = new Date();
    if (body.status === 'completed') order.completed_at = new Date();
  }

  if (body.notes !== undefined) {
    if (!isSeller && !isBuyer) throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
    order.notes = body.notes;
  }
  if (body.requirements !== undefined && isBuyer) {
    order.requirements = body.requirements;
  }

  await order.save();
  return order;
};

const cancelOrder = async (orderId, user, body) => {
  const order = await GigOrder.findByPk(orderId);
  if (!order) throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
  assertOrderActor(order, user);
  order.status = 'cancelled';
  order.cancelled_at = new Date();
  order.cancellation_reason = body.reason;
  await order.save();
  return order;
};

const listSubmissions = async (orderId, user) => {
  const order = await GigOrder.findByPk(orderId);
  if (!order) throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
  assertOrderActor(order, user);
  return OrderSubmission.findAll({ where: { order_id: orderId }, paranoid: false });
};

const createSubmission = async (orderId, user, body) => {
  const order = await GigOrder.findByPk(orderId);
  if (!order) throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
  if (order.seller_id !== user.id && user.role !== 'admin') {
    throw new ApiError(403, 'Only sellers can submit work', 'FORBIDDEN');
  }
  if (!['in_progress', 'delivered'].includes(order.status)) {
    throw new ApiError(400, 'Order must be in progress to submit work', 'INVALID_ORDER_STATUS');
  }
  const submission = await OrderSubmission.create({
    order_id: orderId,
    submitter_id: user.id,
    message: body.message,
    attachments: body.attachments,
    metadata: body.metadata,
  });
  order.status = 'delivered';
  order.delivered_at = order.delivered_at || new Date();
  await order.save();
  return submission;
};

const updateSubmission = async (submissionId, user, body) => {
  const submission = await OrderSubmission.findByPk(submissionId, { include: [{ model: GigOrder, as: 'order' }] });
  if (!submission) throw new ApiError(404, 'Submission not found', 'SUBMISSION_NOT_FOUND');
  const order = submission.order;
  const isSeller = order.seller_id === user.id || user.role === 'admin';
  const isBuyer = order.buyer_id === user.id || user.role === 'admin';
  if (!isSeller && !isBuyer) throw new ApiError(403, 'Forbidden', 'FORBIDDEN');

  if (isSeller && body.message !== undefined) submission.message = body.message;
  if (isSeller && body.attachments !== undefined) submission.attachments = body.attachments;

  if (isBuyer && body.status) {
    if (!['revision_requested', 'accepted'].includes(body.status)) {
      throw new ApiError(400, 'Invalid submission status', 'INVALID_STATUS');
    }
    submission.status = body.status;
    submission.responded_at = new Date();
    if (body.status === 'revision_requested') {
      order.status = 'in_progress';
    }
    if (body.status === 'accepted') {
      order.status = 'completed';
      order.completed_at = new Date();
    }
    await order.save();
  }

  await submission.save();
  return submission;
};

const listOrderReviews = async (orderId, user) => {
  const order = await GigOrder.findByPk(orderId);
  if (!order) throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
  assertOrderActor(order, user);
  return OrderReview.findAll({
    where: { order_id: orderId },
    include: [
      { model: User, as: 'reviewer', attributes: ['id', 'email'] },
      { model: User, as: 'reviewee', attributes: ['id', 'email'] },
    ],
    paranoid: false,
  });
};

const createOrderReview = async (orderId, user, body) => {
  const order = await GigOrder.findByPk(orderId);
  if (!order) throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
  assertOrderActor(order, user);
  if (order.status !== 'completed') {
    throw new ApiError(400, 'Reviews can only be left on completed orders', 'ORDER_NOT_COMPLETED');
  }
  if (user.id === body.reviewee_id) {
    throw new ApiError(400, 'Cannot review yourself', 'INVALID_REVIEW');
  }
  const reviewee = await User.findByPk(body.reviewee_id);
  if (!reviewee) {
    throw new ApiError(404, 'Reviewee not found', 'USER_NOT_FOUND');
  }
  if (![order.buyer_id, order.seller_id].includes(body.reviewee_id)) {
    throw new ApiError(400, 'Reviewee must be part of the order', 'INVALID_REVIEW');
  }
  const existing = await OrderReview.findOne({
    where: { order_id: orderId, reviewer_id: user.id, reviewee_id: body.reviewee_id },
  });
  if (existing) {
    throw new ApiError(409, 'Review already submitted', 'REVIEW_EXISTS');
  }
  return OrderReview.create({
    order_id: orderId,
    reviewer_id: user.id,
    reviewee_id: body.reviewee_id,
    rating: body.rating,
    comment: body.comment,
    metadata: body.metadata,
  });
};

const gigAnalytics = async (gigId, user) => {
  const gig = await Gig.findByPk(gigId);
  if (!gig) throw new ApiError(404, 'Gig not found', 'GIG_NOT_FOUND');
  ensureGigOwner(gig, user);
  const [orders, completed, revenue] = await Promise.all([
    GigOrder.count({ where: { gig_id: gigId } }),
    GigOrder.count({ where: { gig_id: gigId, status: 'completed' } }),
    GigOrder.sum('price', { where: { gig_id: gigId, status: 'completed' } }),
  ]);
  return {
    total_orders: orders,
    completed_orders: completed,
    conversion_rate: orders ? Number(((completed / orders) * 100).toFixed(2)) : 0,
    total_revenue: Number(revenue || 0),
    average_order_value: completed ? Number(((revenue || 0) / completed).toFixed(2)) : 0,
  };
};

module.exports = {
  listGigs,
  createGig,
  getGig,
  updateGig,
  deleteGig,
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
  listOrderReviews,
  createOrderReview,
  gigAnalytics,
};
