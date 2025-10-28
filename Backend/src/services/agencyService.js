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
    'location',
    'website',
    'created_at',
    'updated_at',
  ],
  analyticsLabel: 'agency',
  analyticsLabelPlural: 'agencies',
  allowPublicListing: true,
});
