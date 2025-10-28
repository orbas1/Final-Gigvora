const models = require('../models');
const { createOrganizationService } = require('./organizationService');

module.exports = createOrganizationService({
  model: models.Agency,
  memberModel: models.AgencyMember,
  memberForeignKey: 'agency_id',
  memberAlias: 'team',
  defaultMemberRole: 'member',
  managerRoles: ['admin', 'lead'],
  allowedSortFields: ['created_at', 'updated_at', 'name', 'verified_at'],
  selectableFields: [
    'id',
    'name',
    'slug',
    'verified',
    'verified_at',
    'description',
    'location',
    'website',
    'services',
    'specialties',
    'logo_url',
    'banner_url',
    'metadata',
    'analytics_snapshot',
    'owner_id',
    'created_at',
    'updated_at',
  ],
  analyticsLabel: 'agency',
  analyticsLabelPlural: 'agencies',
  allowPublicListing: true,
});
