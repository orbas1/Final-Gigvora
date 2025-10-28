const models = require('../models');
const { createOrganizationService } = require('./organizationService');

module.exports = createOrganizationService({
  model: models.Company,
  memberModel: models.CompanyEmployee,
  memberForeignKey: 'company_id',
  memberAlias: 'employees',
  defaultMemberRole: 'member',
  managerRoles: ['admin'],
  allowedSortFields: ['created_at', 'updated_at', 'name', 'verified_at'],
  selectableFields: [
    'id',
    'name',
    'slug',
    'verified',
    'verified_at',
    'industry',
    'size',
    'headquarters',
    'website',
    'created_at',
    'updated_at',
  ],
  analyticsLabel: 'company',
  analyticsLabelPlural: 'companies',
  allowPublicListing: true,
});
