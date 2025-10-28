const { Op, fn, col, literal } = require('sequelize');
const {
  Gig,
  GigTag,
  GigPackage,
  GigAddon,
  GigFaq,
  GigMedia,
  GigOrder,
  GigSubmission,
  GigReview,
  GigMetric,
  User,
  sequelize,
} = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { buildPagination, encodeCursor } = require('../utils/pagination');

const ALLOWED_GIG_SORT = ['created_at', 'updated_at', 'price_min', 'price_max', 'orders_count', 'views_count'];
const PUBLIC_GIG_STATUSES = new Set(['active']);
const PACKAGE_TIERS = ['basic', 'standard', 'premium'];
const MAX_REVIEW_SCORE = 5;

const normalizeTags = (tags = []) =>
  [...new Set(tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))];

const formatGig = (gig) => {
  if (!gig) return gig;
  const plain = gig.toJSON();
  if (plain.tagAssignments) {
    plain.tags = plain.tagAssignments.map((tag) => tag.tag);
    delete plain.tagAssignments;
  }
  if (plain.packages) {
    plain.packages = plain.packages
      .slice()
      .sort((a, b) => PACKAGE_TIERS.indexOf(a.tier) - PACKAGE_TIERS.indexOf(b.tier));
  }
  return plain;
};

const ensureAuthenticated = (user) => {
  if (!user) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }
};

const ensureGigOwner = (gig, user) => {
  ensureAuthenticated(user);
  if (user.role === 'admin') return;
  if (gig.seller_id !== user.id) {
    throw new ApiError(403, 'Only gig owners can perform this action', 'FORBIDDEN');
  }
};

const ensureGigParticipant = async (order, user) => {
  ensureAuthenticated(user);
  if (user.role === 'admin') return;
  if (![order.buyer_id, order.seller_id].includes(user.id)) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }
};

const applyGigTagChanges = async (gigId, tags = [], transaction) => {
  const normalized = normalizeTags(tags);
  await GigTag.destroy({ where: { gig_id: gigId }, transaction });
  if (normalized.length) {
    await GigTag.bulkCreate(
      normalized.map((tag) => ({ gig_id: gigId, tag })),
      { transaction }
    );
  }
  await Gig.update({ tags_count: normalized.length }, { where: { id: gigId }, transaction });
};

const refreshGigAggregates = async (gigId, transaction) => {
  const [ordersAggregate, reviewsAggregate] = await Promise.all([
    GigOrder.findOne({
      where: { gig_id: gigId },
      attributes: [
        [fn('COUNT', col('id')), 'count'],
        [fn('SUM', col('price')), 'revenue'],
      ],
      raw: true,
      transaction,
    }),
    GigReview.findOne({
      where: { gig_id: gigId },
      attributes: [
        [fn('COUNT', col('id')), 'count'],
        [fn('AVG', col('rating')), 'avg_rating'],
      ],
      raw: true,
      transaction,
    }),
  ]);

  const updates = {
    orders_count: Number(ordersAggregate?.count || 0),
    reviews_count: Number(reviewsAggregate?.count || 0),
  };

  if (reviewsAggregate?.avg_rating) {
    updates.rating_average = Number(Number(reviewsAggregate.avg_rating).toFixed(2));
  } else {
    updates.rating_average = null;
  }

  await Gig.update(updates, { where: { id: gigId }, transaction });
};

const listGigs = async (user, query) => {
  const pagination = buildPagination(query, ALLOWED_GIG_SORT);
  const include = [];
  const where = {};
  const expansions = new Set(
    (query.expand || '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
  );

  if (query.seller_id) {
    where.seller_id = query.seller_id;
  }
  if (query.status) {
    where.status = query.status;
  }
  if (query.q) {
    const term = `%${String(query.q).toLowerCase()}%`;
    where[Op.or] = [
      sequelize.where(fn('LOWER', col('Gig.title')), { [Op.like]: term }),
      sequelize.where(fn('LOWER', col('Gig.description')), { [Op.like]: term }),
    ];
  }
  if (query.tags) {
    const tags = normalizeTags(query.tags.split(','));
    if (tags.length) {
      include.push({
        model: GigTag,
        as: 'tagAssignments',
        where: { tag: { [Op.in]: tags } },
        attributes: ['tag'],
        required: true,
      });
    }
  } else if (expansions.has('tags')) {
    include.push({ model: GigTag, as: 'tagAssignments', attributes: ['tag'] });
  }
  if (expansions.has('packages')) {
    include.push({ model: GigPackage, as: 'packages' });
  }
  if (expansions.has('seller')) {
    include.push({ model: User, as: 'seller', attributes: ['id', 'email', 'role'] });
  }

  if (query.price_min) {
    where.price_max = { [Op.gte]: Number(query.price_min) };
  }
  if (query.price_max) {
    where.price_min = { [Op.lte]: Number(query.price_max) };
  }

  const includeDeleted = query.include === 'deleted' && user?.role === 'admin';

  const rows = await Gig.findAll({
    where,
    include,
    order: pagination.order,
    limit: pagination.limit + 1,
    paranoid: !includeDeleted,
  });

  const hasNext = rows.length > pagination.limit;
  const items = rows.slice(0, pagination.limit).map(formatGig);
  const nextCursor = hasNext ? encodeCursor(rows[pagination.limit - 1][pagination.sortField]) : null;

  const response = {
    data: items,
    pageInfo: {
      nextCursor,
      hasNextPage: Boolean(hasNext && nextCursor),
    },
  };

  if (query.analytics && items.length) {
    const analytics = await Gig.findAll({
      where,
      attributes: [
        [fn('COUNT', col('Gig.id')), 'total'],
        [fn('SUM', col('orders_count')), 'orders'],
        [fn('AVG', col('rating_average')), 'avg_rating'],
        [fn('SUM', literal('COALESCE(price_min,0)')), 'min_pricing_sum'],
      ],
      raw: true,
      paranoid: !includeDeleted,
    });
    response.analytics = analytics[0];
  }

  return response;
};

const ensureCanCreateGig = (user) => {
  ensureAuthenticated(user);
  if (!['freelancer', 'agency', 'admin'].includes(user.role)) {
    throw new ApiError(403, 'Only freelancer or agency accounts can publish gigs', 'FORBIDDEN');
  }
};

const createGig = async (user, payload) => {
  ensureCanCreateGig(user);
  return sequelize.transaction(async (transaction) => {
    const gig = await Gig.create(
      {
        seller_id: user.id,
        title: payload.title,
        description: payload.description,
        category: payload.category,
        subcategory: payload.subcategory,
        status: payload.status || 'draft',
        price_min: payload.price_min,
        price_max: payload.price_max,
        currency: payload.currency || 'USD',
        delivery_time_days: payload.delivery_time_days,
        metadata: payload.metadata,
      },
      { transaction }
    );

    if (payload.tags?.length) {
      await applyGigTagChanges(gig.id, payload.tags, transaction);
    }

    if (Array.isArray(payload.packages) && payload.packages.length) {
      await Promise.all(
        payload.packages.map((pkg) =>
          GigPackage.upsert(
            {
              gig_id: gig.id,
              tier: pkg.tier,
              name: pkg.name,
              description: pkg.description,
              price: pkg.price,
              currency: pkg.currency || payload.currency || 'USD',
              delivery_days: pkg.delivery_days,
              revisions: pkg.revisions,
              features: pkg.features,
              is_active: pkg.is_active ?? true,
            },
            { transaction }
          )
        )
      );
    }

    await refreshGigAggregates(gig.id, transaction);

    await gig.reload({
      include: [
        { model: GigTag, as: 'tagAssignments', attributes: ['tag'] },
        { model: GigPackage, as: 'packages' },
      ],
      transaction,
    });

    return formatGig(gig);
  });
};

const findGigById = async (id, { includeDeleted = false, expand = [] } = {}) => {
  const include = [];
  const expansions = new Set(expand);
  if (expansions.has('tags')) {
    include.push({ model: GigTag, as: 'tagAssignments', attributes: ['tag'] });
  }
  if (expansions.has('packages')) {
    include.push({ model: GigPackage, as: 'packages' });
  }
  if (expansions.has('addons')) {
    include.push({ model: GigAddon, as: 'addons' });
  }
  if (expansions.has('faqs')) {
    include.push({ model: GigFaq, as: 'faqs' });
  }
  if (expansions.has('media')) {
    include.push({ model: GigMedia, as: 'media' });
  }
  if (expansions.has('seller')) {
    include.push({ model: User, as: 'seller', attributes: ['id', 'email', 'role'] });
  }
  if (expansions.has('reviews')) {
    include.push({
      model: GigReview,
      as: 'reviews',
      include: [
        { model: User, as: 'reviewer', attributes: ['id', 'email', 'role'] },
        { model: User, as: 'reviewee', attributes: ['id', 'email', 'role'] },
      ],
    });
  }

  const gig = await Gig.findByPk(id, { include, paranoid: !includeDeleted });
  return gig;
};

const ensureGigReadable = (gig, user) => {
  if (!gig) {
    throw new ApiError(404, 'Gig not found', 'GIG_NOT_FOUND');
  }
  if (PUBLIC_GIG_STATUSES.has(gig.status)) {
    return true;
  }
  if (!user) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }
  if (user.role === 'admin' || gig.seller_id === user.id) {
    return true;
  }
  throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
};

const getGig = async (id, user, { includeDeleted = false, expand = [] } = {}) => {
  const gig = await findGigById(id, { includeDeleted, expand });
  ensureGigReadable(gig, user);
  return formatGig(gig);
};

const updateGig = async (id, user, payload) => {
  const gig = await findGigById(id, { includeDeleted: user?.role === 'admin' });
  if (!gig) {
    throw new ApiError(404, 'Gig not found', 'GIG_NOT_FOUND');
  }
  ensureGigOwner(gig, user);

  return sequelize.transaction(async (transaction) => {
    Object.assign(gig, {
      title: payload.title ?? gig.title,
      description: payload.description ?? gig.description,
      category: payload.category ?? gig.category,
      subcategory: payload.subcategory ?? gig.subcategory,
      status: payload.status ?? gig.status,
      price_min: payload.price_min ?? gig.price_min,
      price_max: payload.price_max ?? gig.price_max,
      currency: payload.currency ?? gig.currency,
      delivery_time_days: payload.delivery_time_days ?? gig.delivery_time_days,
      metadata: payload.metadata ?? gig.metadata,
    });

    await gig.save({ transaction });

    if (payload.tags) {
      await applyGigTagChanges(gig.id, payload.tags, transaction);
    }

    if (Array.isArray(payload.packages)) {
      await Promise.all(
        payload.packages.map((pkg) =>
          GigPackage.upsert(
            {
              gig_id: gig.id,
              tier: pkg.tier,
              name: pkg.name,
              description: pkg.description,
              price: pkg.price,
              currency: pkg.currency || gig.currency,
              delivery_days: pkg.delivery_days,
              revisions: pkg.revisions,
              features: pkg.features,
              is_active: pkg.is_active ?? true,
            },
            { transaction }
          )
        )
      );
    }

    await refreshGigAggregates(gig.id, transaction);

    await gig.reload({
      include: [
        { model: GigTag, as: 'tagAssignments', attributes: ['tag'] },
        { model: GigPackage, as: 'packages' },
      ],
      transaction,
    });

    return formatGig(gig);
  });
};

const deleteGig = async (id, user) => {
  const gig = await Gig.findByPk(id);
  if (!gig) {
    throw new ApiError(404, 'Gig not found', 'GIG_NOT_FOUND');
  }
  ensureGigOwner(gig, user);
  await gig.destroy();
  return { success: true };
};

const listPackages = async (gigId, user) => {
  const gig = await Gig.findByPk(gigId);
  if (!gig) {
    throw new ApiError(404, 'Gig not found', 'GIG_NOT_FOUND');
  }
  ensureGigOwner(gig, user);
  const packages = await GigPackage.findAll({ where: { gig_id: gigId } });
  return packages;
};

const upsertPackage = async (gigId, user, payload) => {
  const gig = await Gig.findByPk(gigId);
  if (!gig) {
    throw new ApiError(404, 'Gig not found', 'GIG_NOT_FOUND');
  }
  ensureGigOwner(gig, user);

  if (!PACKAGE_TIERS.includes(payload.tier)) {
    throw new ApiError(400, 'Invalid package tier', 'INVALID_TIER');
  }

  await GigPackage.upsert(
    {
      id: payload.id,
      gig_id: gigId,
      tier: payload.tier,
      name: payload.name,
      description: payload.description,
      price: payload.price,
      currency: payload.currency || gig.currency,
      delivery_days: payload.delivery_days,
      revisions: payload.revisions,
      features: payload.features,
      is_active: payload.is_active ?? true,
    }
  );

  await refreshGigAggregates(gig.id);
  const lookup = payload.id
    ? { id: payload.id }
    : { gig_id: gigId, tier: payload.tier };
  return GigPackage.findOne({ where: lookup });
};

const updatePackage = async (packageId, user, payload) => {
  const pkg = await GigPackage.findByPk(packageId, { include: [{ model: Gig, as: 'gig' }] });
  if (!pkg) {
    throw new ApiError(404, 'Package not found', 'PACKAGE_NOT_FOUND');
  }
  ensureGigOwner(pkg.gig, user);

  if (payload.tier && !PACKAGE_TIERS.includes(payload.tier)) {
    throw new ApiError(400, 'Invalid package tier', 'INVALID_TIER');
  }

  Object.assign(pkg, {
    tier: payload.tier ?? pkg.tier,
    name: payload.name ?? pkg.name,
    description: payload.description ?? pkg.description,
    price: payload.price ?? pkg.price,
    currency: payload.currency ?? pkg.currency,
    delivery_days: payload.delivery_days ?? pkg.delivery_days,
    revisions: payload.revisions ?? pkg.revisions,
    features: payload.features ?? pkg.features,
    is_active: payload.is_active ?? pkg.is_active,
  });

  await pkg.save();
  await refreshGigAggregates(pkg.gig_id);
  return pkg;
};

const deletePackage = async (packageId, user) => {
  const pkg = await GigPackage.findByPk(packageId, { include: [{ model: Gig, as: 'gig' }] });
  if (!pkg) {
    throw new ApiError(404, 'Package not found', 'PACKAGE_NOT_FOUND');
  }
  ensureGigOwner(pkg.gig, user);
  await pkg.destroy();
  await refreshGigAggregates(pkg.gig_id);
  return { success: true };
};

const listAddons = async (gigId, user) => {
  const gig = await Gig.findByPk(gigId);
  if (!gig) {
    throw new ApiError(404, 'Gig not found', 'GIG_NOT_FOUND');
  }
  ensureGigOwner(gig, user);
  return GigAddon.findAll({ where: { gig_id: gigId } });
};

const createAddon = async (gigId, user, payload) => {
  const gig = await Gig.findByPk(gigId);
  if (!gig) {
    throw new ApiError(404, 'Gig not found', 'GIG_NOT_FOUND');
  }
  ensureGigOwner(gig, user);

  const addon = await GigAddon.create({
    gig_id: gigId,
    title: payload.title,
    description: payload.description,
    price: payload.price,
    currency: payload.currency || gig.currency,
    delivery_days: payload.delivery_days,
    is_active: payload.is_active ?? true,
  });

  return addon;
};

const updateAddon = async (addonId, user, payload) => {
  const addon = await GigAddon.findByPk(addonId, { include: [{ model: Gig, as: 'gig' }] });
  if (!addon) {
    throw new ApiError(404, 'Addon not found', 'ADDON_NOT_FOUND');
  }
  ensureGigOwner(addon.gig, user);

  Object.assign(addon, {
    title: payload.title ?? addon.title,
    description: payload.description ?? addon.description,
    price: payload.price ?? addon.price,
    currency: payload.currency ?? addon.currency,
    delivery_days: payload.delivery_days ?? addon.delivery_days,
    is_active: payload.is_active ?? addon.is_active,
  });

  await addon.save();
  return addon;
};

const deleteAddon = async (addonId, user) => {
  const addon = await GigAddon.findByPk(addonId, { include: [{ model: Gig, as: 'gig' }] });
  if (!addon) {
    throw new ApiError(404, 'Addon not found', 'ADDON_NOT_FOUND');
  }
  ensureGigOwner(addon.gig, user);
  await addon.destroy();
  return { success: true };
};

const listFaqs = async (gigId, user) => {
  const gig = await Gig.findByPk(gigId);
  if (!gig) {
    throw new ApiError(404, 'Gig not found', 'GIG_NOT_FOUND');
  }
  ensureGigOwner(gig, user);
  return GigFaq.findAll({ where: { gig_id: gigId }, order: [['order_index', 'ASC']] });
};

const createFaq = async (gigId, user, payload) => {
  const gig = await Gig.findByPk(gigId);
  if (!gig) {
    throw new ApiError(404, 'Gig not found', 'GIG_NOT_FOUND');
  }
  ensureGigOwner(gig, user);
  const faq = await GigFaq.create({
    gig_id: gigId,
    question: payload.question,
    answer: payload.answer,
    order_index: payload.order_index || 1,
  });
  return faq;
};

const updateFaq = async (faqId, user, payload) => {
  const faq = await GigFaq.findByPk(faqId, { include: [{ model: Gig, as: 'gig' }] });
  if (!faq) {
    throw new ApiError(404, 'FAQ not found', 'FAQ_NOT_FOUND');
  }
  ensureGigOwner(faq.gig, user);

  Object.assign(faq, {
    question: payload.question ?? faq.question,
    answer: payload.answer ?? faq.answer,
    order_index: payload.order_index ?? faq.order_index,
  });

  await faq.save();
  return faq;
};

const deleteFaq = async (faqId, user) => {
  const faq = await GigFaq.findByPk(faqId, { include: [{ model: Gig, as: 'gig' }] });
  if (!faq) {
    throw new ApiError(404, 'FAQ not found', 'FAQ_NOT_FOUND');
  }
  ensureGigOwner(faq.gig, user);
  await faq.destroy();
  return { success: true };
};

const addMedia = async (gigId, user, payload) => {
  const gig = await Gig.findByPk(gigId);
  if (!gig) {
    throw new ApiError(404, 'Gig not found', 'GIG_NOT_FOUND');
  }
  ensureGigOwner(gig, user);

  const media = await GigMedia.create({
    gig_id: gigId,
    media_type: payload.media_type,
    url: payload.url,
    thumbnail_url: payload.thumbnail_url,
    order_index: payload.order_index || 1,
    metadata: payload.metadata,
  });

  return media;
};

const removeMedia = async (gigId, mediaId, user) => {
  const media = await GigMedia.findOne({
    where: { id: mediaId, gig_id: gigId },
    include: [{ model: Gig, as: 'gig' }],
  });
  if (!media) {
    throw new ApiError(404, 'Media not found', 'MEDIA_NOT_FOUND');
  }
  ensureGigOwner(media.gig, user);
  await media.destroy();
  return { success: true };
};

const listOrders = async (gigId, user) => {
  const gig = await Gig.findByPk(gigId);
  if (!gig) {
    throw new ApiError(404, 'Gig not found', 'GIG_NOT_FOUND');
  }
  ensureGigOwner(gig, user);
  const orders = await GigOrder.findAll({
    where: { gig_id: gigId },
    include: [
      { model: User, as: 'buyer', attributes: ['id', 'email', 'role'] },
      { model: User, as: 'seller', attributes: ['id', 'email', 'role'] },
      { model: GigPackage, as: 'package' },
    ],
  });
  return orders;
};

const createOrder = async (gigId, user, payload) => {
  ensureAuthenticated(user);
  const gig = await Gig.findByPk(gigId, { include: [{ model: GigPackage, as: 'packages' }] });
  if (!gig) {
    throw new ApiError(404, 'Gig not found', 'GIG_NOT_FOUND');
  }
  if (gig.seller_id === user.id) {
    throw new ApiError(403, 'Sellers cannot purchase their own gig', 'FORBIDDEN');
  }

  const tier = payload.package_tier || payload.tier;
  if (!PACKAGE_TIERS.includes(tier)) {
    throw new ApiError(400, 'Invalid package tier', 'INVALID_TIER');
  }

  const selectedPackage = gig.packages?.find((pkg) => pkg.tier === tier);
  if (!selectedPackage) {
    throw new ApiError(404, 'Selected package not available', 'PACKAGE_NOT_FOUND');
  }

  const price = payload.price ?? selectedPackage.price;
  const currency = payload.currency || selectedPackage.currency || gig.currency;

  const order = await GigOrder.create({
    gig_id: gigId,
    package_id: selectedPackage.id,
    buyer_id: user.id,
    seller_id: gig.seller_id,
    package_tier: tier,
    price,
    currency,
    status: 'requirements',
    requirements: payload.requirements,
    requirements_submitted_at: payload.requirements ? new Date() : null,
    started_at: payload.started_at ?? new Date(),
    due_at: payload.due_at || new Date(Date.now() + (selectedPackage.delivery_days || 7) * 24 * 3600 * 1000),
  });

  await refreshGigAggregates(gigId);
  return order;
};

const getOrder = async (orderId, user) => {
  const order = await GigOrder.findByPk(orderId, {
    include: [
      { model: Gig, as: 'gig' },
      { model: GigPackage, as: 'package' },
      { model: User, as: 'buyer', attributes: ['id', 'email', 'role'] },
      { model: User, as: 'seller', attributes: ['id', 'email', 'role'] },
    ],
  });
  if (!order) {
    throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
  }
  await ensureGigParticipant(order, user);
  return order;
};

const updateOrder = async (orderId, user, payload) => {
  const order = await GigOrder.findByPk(orderId, { include: [{ model: Gig, as: 'gig' }] });
  if (!order) {
    throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
  }
  await ensureGigParticipant(order, user);

  if (payload.status && !['in_progress', 'delivered', 'accepted', 'cancelled', 'refunded', 'requirements'].includes(payload.status)) {
    throw new ApiError(400, 'Invalid order status', 'INVALID_STATUS');
  }

  Object.assign(order, {
    status: payload.status ?? order.status,
    requirements: payload.requirements ?? order.requirements,
    requirements_submitted_at: payload.requirements ? new Date() : order.requirements_submitted_at,
    started_at: payload.started_at ?? order.started_at,
    due_at: payload.due_at ?? order.due_at,
    delivered_at: payload.delivered_at ?? order.delivered_at,
    accepted_at: payload.accepted_at ?? order.accepted_at,
  });

  if (payload.status === 'cancelled') {
    order.cancelled_at = new Date();
    order.cancellation_reason = payload.cancellation_reason;
  }
  if (payload.status === 'accepted') {
    order.accepted_at = new Date();
  }
  if (payload.status === 'delivered' && !order.delivered_at) {
    order.delivered_at = new Date();
  }
  if (payload.status === 'in_progress' && !order.started_at) {
    order.started_at = new Date();
  }

  await order.save();
  await refreshGigAggregates(order.gig_id);
  return order;
};

const cancelOrder = async (orderId, user, reason) => {
  const order = await GigOrder.findByPk(orderId);
  if (!order) {
    throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
  }
  await ensureGigParticipant(order, user);

  order.status = 'cancelled';
  order.cancelled_at = new Date();
  order.cancellation_reason = reason || 'Cancelled by participant';
  await order.save();
  await refreshGigAggregates(order.gig_id);
  return order;
};

const listSubmissions = async (orderId, user) => {
  const order = await GigOrder.findByPk(orderId);
  if (!order) {
    throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
  }
  await ensureGigParticipant(order, user);
  return GigSubmission.findAll({
    where: { order_id: orderId },
    include: [{ model: User, as: 'submitter', attributes: ['id', 'email', 'role'] }],
    order: [['created_at', 'ASC']],
  });
};

const createSubmission = async (orderId, user, payload) => {
  const order = await GigOrder.findByPk(orderId);
  if (!order) {
    throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
  }
  if (order.seller_id !== user.id && user.role !== 'admin') {
    throw new ApiError(403, 'Only sellers can submit deliveries', 'FORBIDDEN');
  }

  const submission = await GigSubmission.create({
    order_id: orderId,
    submitted_by: user.id,
    message: payload.message,
    attachments: payload.attachments,
    status: payload.status || 'submitted',
    revision_notes: payload.revision_notes,
  });

  if (order.status === 'in_progress' || order.status === 'requirements') {
    order.status = 'delivered';
    order.delivered_at = new Date();
    await order.save();
    await refreshGigAggregates(order.gig_id);
  }

  return submission;
};

const updateSubmission = async (submissionId, user, payload) => {
  const submission = await GigSubmission.findByPk(submissionId, { include: [{ model: GigOrder, as: 'order' }] });
  if (!submission) {
    throw new ApiError(404, 'Submission not found', 'SUBMISSION_NOT_FOUND');
  }
  const order = submission.order;
  await ensureGigParticipant(order, user);

  if (payload.status && !['submitted', 'revision_requested', 'resubmitted', 'accepted'].includes(payload.status)) {
    throw new ApiError(400, 'Invalid submission status', 'INVALID_STATUS');
  }

  Object.assign(submission, {
    message: payload.message ?? submission.message,
    attachments: payload.attachments ?? submission.attachments,
    status: payload.status ?? submission.status,
    revision_notes: payload.revision_notes ?? submission.revision_notes,
  });

  await submission.save();

  if (payload.status === 'accepted') {
    order.status = 'accepted';
    order.accepted_at = new Date();
    await order.save();
    await refreshGigAggregates(order.gig_id);
  }

  if (payload.status === 'revision_requested') {
    order.status = 'in_progress';
    await order.save();
  }

  return submission;
};

const listOrderReviews = async (orderId, user) => {
  const order = await GigOrder.findByPk(orderId);
  if (!order) {
    throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
  }
  await ensureGigParticipant(order, user);
  return GigReview.findAll({
    where: { order_id: orderId },
    include: [
      { model: User, as: 'reviewer', attributes: ['id', 'email', 'role'] },
      { model: User, as: 'reviewee', attributes: ['id', 'email', 'role'] },
    ],
  });
};

const createOrderReview = async (orderId, user, payload) => {
  const order = await GigOrder.findByPk(orderId);
  if (!order) {
    throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
  }
  await ensureGigParticipant(order, user);

  const existing = await GigReview.findOne({
    where: { order_id: orderId, reviewer_id: user.id },
  });
  if (existing) {
    throw new ApiError(409, 'You have already reviewed this order', 'REVIEW_EXISTS');
  }

  if (payload.rating < 1 || payload.rating > MAX_REVIEW_SCORE) {
    throw new ApiError(400, 'Rating must be between 1 and 5', 'INVALID_RATING');
  }

  const revieweeId = user.id === order.buyer_id ? order.seller_id : order.buyer_id;

  const review = await GigReview.create({
    order_id: orderId,
    gig_id: order.gig_id,
    reviewer_id: user.id,
    reviewee_id: payload.reviewee_id || revieweeId,
    rating: payload.rating,
    communication_rating: payload.communication_rating,
    quality_rating: payload.quality_rating,
    value_rating: payload.value_rating,
    comment: payload.comment,
  });

  await refreshGigAggregates(order.gig_id);
  return review;
};

const getSalesAnalytics = async ({ from, to }) => {
  const where = {};
  if (from) {
    where.created_at = { [Op.gte]: new Date(from) };
  }
  if (to) {
    where.created_at = { ...(where.created_at || {}), [Op.lte]: new Date(to) };
  }
  where.status = { [Op.in]: ['delivered', 'accepted', 'refunded'] };

  const rows = await GigOrder.findAll({
    where,
    attributes: [
      [fn('DATE', col('created_at')), 'day'],
      [fn('COUNT', col('id')), 'orders'],
      [fn('SUM', col('price')), 'revenue'],
    ],
    group: ['day'],
    order: [[literal('day'), 'ASC']],
  });

  return rows.map((row) => ({
    day: row.get('day'),
    orders: Number(row.get('orders') || 0),
    revenue: Number(row.get('revenue') || 0),
  }));
};

const getGigAnalytics = async (gigId) => {
  const gig = await Gig.findByPk(gigId);
  if (!gig) {
    throw new ApiError(404, 'Gig not found', 'GIG_NOT_FOUND');
  }

  const metrics = await GigMetric.findAll({ where: { gig_id: gigId }, order: [['metric_date', 'DESC']] });
  const totals = metrics.reduce(
    (acc, metric) => {
      acc.views += Number(metric.views || 0);
      acc.clicks += Number(metric.clicks || 0);
      acc.orders += Number(metric.orders || 0);
      acc.revenue += Number(metric.revenue || 0);
      return acc;
    },
    { views: 0, clicks: 0, orders: 0, revenue: 0 }
  );

  const ctr = totals.views ? Number(((totals.clicks / totals.views) * 100).toFixed(2)) : 0;
  const aov = totals.orders ? Number((totals.revenue / totals.orders).toFixed(2)) : 0;

  return {
    gig_id: gigId,
    totals,
    ctr,
    average_order_value: aov,
    timeline: metrics,
  };
};

module.exports = {
  listGigs,
  createGig,
  getGig,
  updateGig,
  deleteGig,
  listPackages,
  upsertPackage,
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
  getSalesAnalytics,
  getGigAnalytics,
};
