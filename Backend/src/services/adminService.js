const {
  User,
  Profile,
  Project,
  ProjectBid,
  ProjectMilestone,
  ProjectDeliverable,
  ProjectTimeLog,
  ProjectReview,
  Gig,
  GigAddon,
  GigFaq,
  GigOrder,
  OrderSubmission,
  OrderReview,
} = require('../models');
const { ApiError } = require('../middleware/errorHandler');

const overview = async ({ from, to }) => {
  const totalUsers = await User.count();
  return { totalUsers, from, to };
};

const listUsers = async () => User.findAll({ limit: 100 });

const restoreModels = {
  user: User,
  profile: Profile,
  project: Project,
  project_bid: ProjectBid,
  project_milestone: ProjectMilestone,
  project_deliverable: ProjectDeliverable,
  project_time_log: ProjectTimeLog,
  project_review: ProjectReview,
  gig: Gig,
  gig_addon: GigAddon,
  gig_faq: GigFaq,
  gig_order: GigOrder,
  order_submission: OrderSubmission,
  order_review: OrderReview,
};

const restore = async ({ entity_type, id }) => {
  const model = restoreModels[entity_type];
  if (!model) {
    throw new ApiError(400, 'Unsupported entity_type for restoration', 'INVALID_ENTITY_TYPE');
  }
  const restored = await model.restore({ where: { id } });
  if (!restored) {
    throw new ApiError(404, 'Entity not found or not deleted', 'ENTITY_NOT_FOUND');
  }
  return { success: true };
};

module.exports = { overview, listUsers, restore };
