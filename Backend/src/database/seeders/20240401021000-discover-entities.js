'use strict';

const { v4: uuidv4 } = require('uuid');

const entries = [
  {
    slug: 'indie-creators-lab',
    type: 'groups',
    title: 'Indie Creators Lab',
    subtitle: 'Weekly accountability for solo builders',
    description:
      'A peer-led circle for indie hackers and part-time founders sharing launch roadmaps, monetisation experiments, and retention playbooks.',
    image_url: 'https://cdn.gigvora.com/groups/indie-creators-lab.jpg',
    metadata: {
      link: 'https://community.gigvora.com/groups/indie-creators-lab',
      cadence: 'Weekly standups',
      timezone: 'UTC',
    },
    tags: ['community', 'creator-economy', 'indie-hackers'],
    metrics: { members: 1820, weekly_growth: 4.2, avg_response_minutes: 38 },
    relevance_score: 92.5,
    starts_at: new Date('2023-10-01T00:00:00Z'),
  },
  {
    slug: 'climate-tech-builders',
    type: 'groups',
    title: 'Climate Tech Builders Guild',
    subtitle: 'Open-source tools for net-zero teams',
    description:
      'Engineers, designers, and operators shipping climate tech hardware and software collaborate on lifecycle modelling and regulatory readiness.',
    image_url: 'https://cdn.gigvora.com/groups/climate-tech-builders.png',
    metadata: {
      link: 'https://community.gigvora.com/groups/climate-tech-builders',
      cadence: 'Bi-weekly demo days',
      sponsor: 'Earthrise Coalition',
    },
    tags: ['climate', 'hardware', 'sustainability'],
    metrics: { members: 940, pilot_projects: 28 },
    relevance_score: 88.3,
    starts_at: new Date('2024-01-12T00:00:00Z'),
  },
  {
    slug: 'aurora-dynamics',
    type: 'companies',
    title: 'Aurora Dynamics',
    subtitle: 'Spatial computing studio hiring senior collaborators',
    description:
      'Mixed reality agency building immersive product trials for healthcare, education, and enterprise onboarding with a distributed team in five countries.',
    image_url: 'https://cdn.gigvora.com/companies/aurora-dynamics.png',
    metadata: {
      link: 'https://workwithus.gigvora.com/aurora-dynamics',
      headquarters: 'Reykjavík, Iceland',
      hiring_velocity: '3 roles this quarter',
    },
    tags: ['spatial-computing', 'agency', 'distributed-team'],
    metrics: { active_projects: 17, avg_contract_value: 62000 },
    relevance_score: 90.1,
    starts_at: new Date('2022-06-15T00:00:00Z'),
  },
  {
    slug: 'catalyst-studios',
    type: 'companies',
    title: 'Catalyst Studios',
    subtitle: 'Brand systems for product-led SaaS companies',
    description:
      'Boutique design practice with embedded pods supporting ARR stage startups. Trusted by Series B+ revenue teams for product marketing launches.',
    image_url: 'https://cdn.gigvora.com/companies/catalyst-studios.jpg',
    metadata: {
      link: 'https://workwithus.gigvora.com/catalyst-studios',
      headquarters: 'Austin, USA',
      open_roles: ['Design Lead', 'Content Strategist'],
    },
    tags: ['brand', 'design', 'saas'],
    metrics: { nps: 68, average_contract_weeks: 12 },
    relevance_score: 84.7,
    starts_at: new Date('2021-03-01T00:00:00Z'),
  },
  {
    slug: 'open-source-brand-kit',
    type: 'projects',
    title: 'Open Source Brand Kit',
    subtitle: 'Community-driven visual identity tooling',
    description:
      'Collaborative project delivering accessible brand starter kits for civic tech and climate non-profits with a Creative Commons licensing model.',
    image_url: 'https://cdn.gigvora.com/projects/open-source-brand-kit.png',
    metadata: {
      link: 'https://projects.gigvora.com/open-source-brand-kit',
      maintainers: ['Marina Cole', 'Hasan Tariq'],
    },
    tags: ['open-source', 'design-systems', 'nonprofit'],
    metrics: { contributors: 46, monthly_downloads: 9200 },
    relevance_score: 86.2,
    starts_at: new Date('2023-04-18T00:00:00Z'),
  },
  {
    slug: 'modular-commerce-audit',
    type: 'projects',
    title: 'Modular Commerce Audit Sprint',
    subtitle: '4-week engagement for direct-to-consumer founders',
    description:
      'Cross-functional strike team delivering funnel diagnostics, storefront UX audits, and supply chain instrumentation for DTC brands at $1-5M ARR.',
    image_url: 'https://cdn.gigvora.com/projects/modular-commerce-audit.jpg',
    metadata: {
      link: 'https://projects.gigvora.com/modular-commerce-audit',
      availability: 'Next cohort opens May 12',
    },
    tags: ['ecommerce', 'growth', 'analytics'],
    metrics: { avg_roi_percent: 132, turnaround_days: 28 },
    relevance_score: 91.4,
    starts_at: new Date('2024-02-05T00:00:00Z'),
  },
  {
    slug: 'motion-designer-retainer',
    type: 'gigs',
    title: 'Motion Designer Retainer',
    subtitle: 'Support a fintech launch with weekly animations',
    description:
      'Remote-friendly retainer for a venture-backed fintech building onboarding explainers, in-product motion cues, and paid media assets.',
    image_url: 'https://cdn.gigvora.com/gigs/motion-designer-retainer.gif',
    metadata: {
      link: 'https://gigs.gigvora.com/motion-designer-retainer',
      cadence: '15 hrs/week',
      budget_usd: '3800-4200',
    },
    tags: ['motion', 'fintech', 'after-effects'],
    metrics: { applicants: 43, decision_eta_days: 5 },
    relevance_score: 89.6,
    starts_at: new Date('2024-03-11T00:00:00Z'),
  },
  {
    slug: 'product-ops-contractor',
    type: 'gigs',
    title: 'Product Operations Contractor',
    subtitle: 'Stabilise release rituals for a healthtech scale-up',
    description:
      '12-week contract focused on roadmapping hygiene, beta program orchestration, and cross-team communication cadences across a distributed product org.',
    image_url: 'https://cdn.gigvora.com/gigs/product-ops-contractor.jpg',
    metadata: {
      link: 'https://gigs.gigvora.com/product-ops-contractor',
      cadence: '20 hrs/week',
      timezone_overlap: 'North America & Western Europe',
    },
    tags: ['product-ops', 'healthtech', 'remote'],
    metrics: { stakeholders: 6, sprint_length_days: 14 },
    relevance_score: 87.8,
    starts_at: new Date('2024-02-20T00:00:00Z'),
  },
  {
    slug: 'lead-product-strategist',
    type: 'jobs',
    title: 'Lead Product Strategist',
    subtitle: 'Guide multi-product roadmap for a Series B platform',
    description:
      'Own product discovery, portfolio prioritisation, and experimentation velocity for a hybrid analytics + automation suite serving 2.4k enterprise teams.',
    image_url: 'https://cdn.gigvora.com/jobs/lead-product-strategist.jpg',
    metadata: {
      link: 'https://jobs.gigvora.com/lead-product-strategist',
      salary_range: 'USD 165k-195k + equity',
      location: 'Hybrid - Toronto, Canada',
    },
    tags: ['product-strategy', 'b2b-saas', 'leadership'],
    metrics: { direct_reports: 3, roadmap_horizon_months: 18 },
    relevance_score: 93.8,
    starts_at: new Date('2024-01-01T00:00:00Z'),
  },
  {
    slug: 'ai-research-fellow',
    type: 'jobs',
    title: 'AI Research Fellow',
    subtitle: 'Applied research for responsible language agents',
    description:
      'Advance evaluation tooling, bias mitigation techniques, and human feedback orchestration for high-sensitivity knowledge workflows.',
    image_url: 'https://cdn.gigvora.com/jobs/ai-research-fellow.png',
    metadata: {
      link: 'https://jobs.gigvora.com/ai-research-fellow',
      salary_range: 'USD 145k-175k + lab bonus',
      location: 'Remote - Americas',
    },
    tags: ['ai-safety', 'nlp', 'research'],
    metrics: { publications_per_year: 6, compute_budget_hours: 3200 },
    relevance_score: 95.2,
    starts_at: new Date('2024-04-01T00:00:00Z'),
  },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    for (const entry of entries) {
      const [existing] = await queryInterface.sequelize.query('SELECT id FROM discover_entities WHERE slug = :slug', {
        replacements: { slug: entry.slug },
      });
      if (existing.length) {
        continue;
      }
      const searchTerms = `${entry.title} ${entry.subtitle} ${entry.description} ${(entry.tags || []).join(' ')}`.toLowerCase();
      await queryInterface.bulkInsert('discover_entities', [
        {
          id: uuidv4(),
          slug: entry.slug,
          type: entry.type,
          title: entry.title,
          subtitle: entry.subtitle,
          description: entry.description,
          image_url: entry.image_url,
          metadata: JSON.stringify(entry.metadata || {}),
          tags: JSON.stringify(entry.tags || []),
          metrics: JSON.stringify(entry.metrics || {}),
          relevance_score: entry.relevance_score,
          search_terms: searchTerms,
          starts_at: entry.starts_at,
          status: 'active',
          created_at: now,
          updated_at: now,
        },
      ]);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('discover_entities', { slug: entries.map((entry) => entry.slug) });
  },
};
