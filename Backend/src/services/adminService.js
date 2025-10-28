const { User, Profile, LegalDocument, LegalConsent, WebhookSubscription, WebhookDelivery } = require('../models');
const { ApiError } = require('../middleware/errorHandler');

const overview = async ({ from, to }) => {
  const totalUsers = await User.count();
  return { totalUsers, from, to };
};

const listUsers = async () => User.findAll({ limit: 100 });

const restore = async ({ entity_type, id }) => {
  switch (entity_type) {
    case 'user':
      await User.restore({ where: { id } });
      break;
    case 'profile':
      await Profile.restore({ where: { id } });
      break;
    case 'legal_document':
      await LegalDocument.restore({ where: { id } });
      break;
    case 'legal_consent':
      await LegalConsent.restore({ where: { id } });
      break;
    case 'webhook_subscription':
      await WebhookSubscription.restore({ where: { id } });
      break;
    case 'webhook_delivery':
      await WebhookDelivery.restore({ where: { id } });
      break;
    default:
      throw new ApiError(400, 'Unsupported entity type for restoration', 'INVALID_ENTITY_TYPE');
  }
  return { success: true };
};

module.exports = { overview, listUsers, restore };
