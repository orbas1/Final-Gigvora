const clone = (value) => JSON.parse(JSON.stringify(value))

const mockUser = {
  user: {
    id: 'user-1',
    email: 'ava.stone@gigvora.com',
    name: 'Ava Stone',
    full_name: 'Ava Stone',
    role: 'freelancer',
    active_role: 'freelancer',
    metadata: {
      roles: ['freelancer', 'client', 'agency'],
      location: 'London, United Kingdom',
    },
    created_at: '2023-05-12T09:24:00Z',
  },
}

const mockProfile = {
  id: 'profile-1',
  userId: 'user-1',
  display_name: 'Ava Stone',
  avatar_url:
    'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=facearea&w=256&h=256&q=80',
  headline: 'Product Designer & Community Lead',
  freelancer_overlay: {
    headline: 'Product Designer & Community Lead',
  },
  location: 'London, United Kingdom',
  analytics_snapshot: {
    projects: 8,
    gigs: 5,
    jobs: 3,
  },
}

const mockNotifications = [
  {
    id: 'notif-1',
    title: 'New message from Aurora Labs',
    description: 'Aurora Labs sent you a follow-up about their product redesign brief.',
    read_at: null,
  },
  {
    id: 'notif-2',
    title: 'Proposal shortlisted',
    description: 'Solstice Partners shortlisted your brand accelerator proposal.',
    read_at: '2024-04-09T10:24:00Z',
  },
  {
    id: 'notif-3',
    title: 'Invite to join Growth Collective',
    description: 'You have been invited to join the Growth Collective community.',
    read_at: null,
  },
]

const mockFeedPosts = [
  {
    id: 'post-1',
    title: 'Blueprinting a trust-first onboarding journey',
    created_at: '2024-04-16T08:30:00Z',
    author: {
      id: 'user-22',
      email: 'kai.morgan@gigvora.com',
      profile: {
        display_name: 'Kai Morgan',
        avatar_url:
          'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=facearea&w=128&h=128&q=80',
        location: 'Berlin, Germany',
      },
    },
    content:
      'Shared the wireframes we used to reduce enterprise onboarding friction by 36% last quarter – happy to swap notes with anyone building trust funnels.',
    reaction_count: 128,
    comment_count: 42,
    share_count: 11,
    tags: ['Product Design', 'Journey Mapping'],
    media: [
      {
        url: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&w=1200&q=80',
      },
    ],
  },
  {
    id: 'post-2',
    title: 'Freelance Playbook: Scaling async discovery',
    created_at: '2024-04-14T12:45:00Z',
    author: {
      id: 'user-18',
      email: 'leah.novak@gigvora.com',
      profile: {
        display_name: 'Leah Novak',
        avatar_url:
          'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=facearea&w=128&h=128&q=80',
        location: 'Austin, United States',
      },
    },
    content:
      'We just wrapped a hybrid discovery sprint with a globally distributed founding team – here are the ops rituals that helped us land decisions fast.',
    reaction_count: 203,
    comment_count: 57,
    share_count: 29,
    tags: ['Freelance Ops', 'Playbooks'],
  },
  {
    id: 'post-3',
    title: 'Hiring now: Marketplace experience PM',
    created_at: '2024-04-11T07:05:00Z',
    author: {
      id: 'company-9',
      email: 'talent@lumenhq.com',
      profile: {
        display_name: 'LumenHQ Talent',
        avatar_url:
          'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=facearea&w=128&h=128&q=80',
        location: 'Toronto, Canada',
      },
    },
    content:
      'LumenHQ is opening a lead PM role for our marketplace squad. We are focused on expert vetting, compliance automation, and a global payments rollout.',
    reaction_count: 98,
    comment_count: 21,
    share_count: 14,
    tags: ['Hiring', 'Product Management'],
  },
  {
    id: 'post-4',
    title: 'Case study: Launching guided proposals in 20 days',
    created_at: '2024-04-09T18:15:00Z',
    author: {
      id: 'agency-4',
      email: 'studio@northglow.agency',
      profile: {
        display_name: 'Northglow Agency',
        avatar_url:
          'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=facearea&w=128&h=128&q=80',
        location: 'Stockholm, Sweden',
      },
    },
    content:
      'We helped an enterprise vendor roll out guided proposals with compliance rails in 20 days. Revenue teams now onboard partners 3x faster.',
    reaction_count: 154,
    comment_count: 38,
    share_count: 19,
    tags: ['Case Study', 'Enterprise'],
  },
]

const mockMetrics = {
  totals: {
    requests: 8243,
  },
  error_rate: 0.008,
  latency: {
    avg_ms: 118,
    p95_ms: 264,
  },
  feeds: {
    home: {
      requests: 5620,
    },
    companies: {
      requests: 1380,
    },
  },
}

const mockPeople = [
  {
    id: 'person-1',
    display_name: 'Noah Rivers',
    headline: 'Fractional CTO · Platform scale-ups',
    mutual_connections: 12,
  },
  {
    id: 'person-2',
    display_name: 'Siena Kapoor',
    headline: 'Product Marketing Leader',
    mutual_connections: 7,
  },
  {
    id: 'person-3',
    display_name: 'Ibrahim Odeh',
    headline: 'Staff Engineer · Payments',
    mutual_connections: 18,
  },
  {
    id: 'person-4',
    display_name: 'Amelia Brooks',
    headline: 'Community Builder · Talent Ecosystems',
    mutual_connections: 5,
  },
]

const mockGroups = [
  { id: 'group-1', name: 'Product Leaders Collective' },
  { id: 'group-2', name: 'Async Operators' },
  { id: 'group-3', name: 'Global Talent Guild' },
]

const mockCompanies = [
  { id: 'company-1', brand_name: 'Aurora Fintech', industry: 'Fintech' },
  { id: 'company-2', brand_name: 'Northwind Ventures', industry: 'Venture Studio' },
  { id: 'company-3', brand_name: 'Solstice Partners', industry: 'Consulting' },
]

const mockProjects = [
  {
    id: 'project-1',
    title: 'Global onboarding experience overhaul',
    status: 'Open',
    budget_min: 28000,
    budget_max: 42000,
    budget_currency: 'USD',
    updated_at: '2024-04-15T10:12:00Z',
  },
  {
    id: 'project-2',
    title: 'Growth community launch playbook',
    status: 'In Review',
    budget_min: 12000,
    budget_max: 18000,
    budget_currency: 'USD',
    updated_at: '2024-04-12T14:55:00Z',
  },
  {
    id: 'project-3',
    title: 'Employer brand story system',
    status: 'Open',
    budget_min: 9000,
    budget_max: 15000,
    budget_currency: 'USD',
    updated_at: '2024-04-08T09:03:00Z',
  },
]

const mockGigs = [
  {
    id: 'gig-1',
    title: 'Product storytelling sprint',
    price: 3200,
    currency: 'USD',
    delivery_time: '10 days',
    updated_at: '2024-04-13T11:24:00Z',
  },
  {
    id: 'gig-2',
    title: 'Investor ready pitch audit',
    price: 2200,
    currency: 'USD',
    delivery_time: '7 days',
    updated_at: '2024-04-11T09:14:00Z',
  },
  {
    id: 'gig-3',
    title: 'Community ops blueprint',
    price: 1900,
    currency: 'USD',
    delivery_time: '12 days',
    updated_at: '2024-04-09T16:44:00Z',
  },
]

const mockJobs = [
  {
    id: 'job-1',
    title: 'Lead Product Designer',
    company: { brand_name: 'Skyline OS' },
    salary_min: 120000,
    salary_max: 145000,
    salary_currency: 'USD',
    status: 'Open',
    hires_count: 2,
    applications_count: 48,
    updated_at: '2024-04-10T15:30:00Z',
  },
  {
    id: 'job-2',
    title: 'Head of Growth Marketing',
    company: { brand_name: 'Atlas Collective' },
    salary_min: 95000,
    salary_max: 125000,
    salary_currency: 'USD',
    status: 'Interviewing',
    hires_count: 1,
    applications_count: 63,
    updated_at: '2024-04-14T19:10:00Z',
  },
  {
    id: 'job-3',
    title: 'Marketplace Operations Lead',
    company: { brand_name: 'Pulse Labs' },
    salary_min: 105000,
    salary_max: 135000,
    salary_currency: 'USD',
    status: 'Open',
    hires_count: 0,
    applications_count: 39,
    updated_at: '2024-04-12T08:20:00Z',
  },
]

const mockPortfolio = [
  {
    id: 'doc-1',
    title: 'Gigvora Playbook 2024',
    format: 'PDF',
    visibility: 'Private',
    updated_at: '2024-03-28T09:00:00Z',
  },
  {
    id: 'doc-2',
    title: 'Community Systems Blueprint',
    format: 'Link',
    visibility: 'Shared',
    updated_at: '2024-04-02T12:34:00Z',
  },
]

const mockEscrow = {
  data: [
    {
      id: 'escrow-1',
      reference: 'ESC-4721',
      status: 'Funded',
      amount: 18400,
      currency: 'USD',
      updated_at: '2024-04-13T16:00:00Z',
    },
    {
      id: 'escrow-2',
      reference: 'ESC-4688',
      status: 'Released',
      amount: 9200,
      currency: 'USD',
      updated_at: '2024-04-09T09:40:00Z',
    },
  ],
  analytics: {
    in_flight: 27600,
    released_this_month: 18200,
  },
}

const mockDisputes = [
  {
    id: 'dispute-1',
    subject: 'Scope clarification for Aurora Fintech',
    status: 'Mediating',
    updated_at: '2024-04-11T11:00:00Z',
  },
  {
    id: 'dispute-2',
    subject: 'Payment release for Skyline OS',
    status: 'Resolved',
    updated_at: '2024-04-08T17:20:00Z',
  },
]

const mockLedger = [
  {
    id: 'txn-1',
    reference: 'INV-2041',
    type: 'Invoice',
    amount: 5400,
    currency: 'USD',
    status: 'Paid',
    created_at: '2024-04-05T13:10:00Z',
  },
  {
    id: 'txn-2',
    reference: 'PAYOUT-993',
    type: 'Payout',
    amount: -4200,
    currency: 'USD',
    status: 'Completed',
    created_at: '2024-04-07T09:45:00Z',
  },
]

const mockAgencies = [
  {
    id: 'agency-1',
    name: 'Northglow Agency',
    region: 'Nordics',
    clients: 38,
  },
  {
    id: 'agency-2',
    name: 'Signal & Co.',
    region: 'US & Canada',
    clients: 52,
  },
]

const mockInvoices = [
  {
    id: 'invoice-1',
    number: 'INV-2041',
    amount: 5400,
    currency: 'USD',
    due_at: '2024-04-20T00:00:00Z',
    status: 'Due',
  },
  {
    id: 'invoice-2',
    number: 'INV-2039',
    amount: 3600,
    currency: 'USD',
    due_at: '2024-04-15T00:00:00Z',
    status: 'Paid',
  },
]

const mockPayouts = [
  {
    id: 'payout-1',
    reference: 'PO-4481',
    amount: 8400,
    currency: 'USD',
    status: 'Processing',
    created_at: '2024-04-13T18:30:00Z',
  },
  {
    id: 'payout-2',
    reference: 'PO-4474',
    amount: 6200,
    currency: 'USD',
    status: 'Completed',
    created_at: '2024-04-09T10:20:00Z',
  },
]

const mockEarnings = {
  summary: {
    month: 'April 2024',
    gross: 24800,
    net: 21400,
  },
  breakdown: [
    {
      label: 'Projects',
      value: 12800,
    },
    {
      label: 'Gigs',
      value: 5800,
    },
    {
      label: 'Retainers',
      value: 6200,
    },
  ],
}

const mockUsers = [
  {
    id: 'user-101',
    email: 'mai.chen@gigvora.com',
    profile: { display_name: 'Mai Chen' },
    role: 'company',
  },
  {
    id: 'user-102',
    email: 'luca.parejo@gigvora.com',
    profile: { display_name: 'Luca Parejo' },
    role: 'freelancer',
  },
]

const mockOrgs = [
  {
    id: 'org-1',
    name: 'Aurora Fintech',
    type: 'Company',
    status: 'Active',
  },
  {
    id: 'org-2',
    name: 'Northglow Agency',
    type: 'Agency',
    status: 'Verified',
  },
]

const mockReports = [
  {
    id: 'report-1',
    name: 'Marketplace GMV',
    status: 'Ready',
    generated_at: '2024-04-12T07:00:00Z',
  },
  {
    id: 'report-2',
    name: 'Onboarding conversion',
    status: 'Processing',
    generated_at: '2024-04-14T09:24:00Z',
  },
]

const mockAudit = [
  {
    id: 'audit-1',
    action: 'Updated payout threshold',
    actor: 'Sophie K. (Admin)',
    created_at: '2024-04-15T11:15:00Z',
  },
  {
    id: 'audit-2',
    action: 'Resolved dispute ESC-4688',
    actor: 'Marcus T. (Moderator)',
    created_at: '2024-04-12T18:30:00Z',
  },
]

const mockLobbies = [
  {
    id: 'lobby-1',
    topic: 'Product matchmaking · 5 min',
    duration: 5,
    cost: 'Free',
    start_at: '2024-04-16T17:00:00Z',
  },
  {
    id: 'lobby-2',
    topic: 'Growth experiments · 2 min',
    duration: 2,
    cost: '$9',
    start_at: '2024-04-16T18:00:00Z',
  },
]

const mockMarketplace = [
  {
    id: 'market-1',
    title: 'AI onboarding audit',
    owner: { display_name: 'Atlas Collective' },
    price: 4200,
    currency: 'USD',
    updated_at: '2024-04-14T08:50:00Z',
  },
  {
    id: 'market-2',
    title: 'Community activation sprint',
    owner: { display_name: 'Signal & Co.' },
    price: 3600,
    currency: 'USD',
    updated_at: '2024-04-13T12:20:00Z',
  },
]

const mockEvents = [
  {
    id: 'event-1',
    title: 'Interview · Pulse Labs',
    start_at: '2024-04-17T14:00:00Z',
    end_at: '2024-04-17T15:00:00Z',
    type: 'Interview',
  },
  {
    id: 'event-2',
    title: 'Milestone · Aurora rollout',
    start_at: '2024-04-18T10:00:00Z',
    end_at: '2024-04-18T11:30:00Z',
    type: 'Milestone',
  },
]

const mockTickets = [
  {
    id: 'ticket-1',
    subject: 'Escrow release confirmation',
    status: 'Waiting on client',
    updated_at: '2024-04-15T09:12:00Z',
  },
  {
    id: 'ticket-2',
    subject: 'API credential rotation',
    status: 'Resolved',
    updated_at: '2024-04-12T18:05:00Z',
  },
]

const mockSettings = {
  account: {
    email: 'ava.stone@gigvora.com',
    name: 'Ava Stone',
  },
  security: {
    two_factor_enabled: true,
    updated_at: '2024-04-10T07:40:00Z',
  },
  notifications: {
    marketing: false,
    product: true,
    payouts: true,
  },
}

const mockConnections = {
  data: [
    {
      id: 'conn-1',
      name: 'Aiko Chen',
      title: 'Operations Lead · LumenHQ',
      connected_at: '2023-12-01T00:00:00Z',
    },
    {
      id: 'conn-2',
      name: 'Mateo Silva',
      title: 'Founder · Aurora Labs',
      connected_at: '2024-01-11T00:00:00Z',
    },
    {
      id: 'conn-3',
      name: 'Zara Khan',
      title: 'Head of Experience · Northglow',
      connected_at: '2023-11-05T00:00:00Z',
    },
  ],
  analytics: {
    accepted: 248,
    total: 386,
  },
}

const mockThreads = [
  {
    id: 'thread-1',
    title: 'Aurora Fintech · Delivery',
    participants: [
      {
        id: 'participant-1',
        user: {
          email: 'mateo.silva@aurora-fintech.com',
          profile: { display_name: 'Mateo Silva' },
        },
      },
      {
        id: 'participant-2',
        user: {
          email: 'ava.stone@gigvora.com',
          profile: { display_name: 'Ava Stone' },
        },
      },
    ],
    last_message: {
      body: 'Thanks for the revised prototype walkthrough – the leadership team loved the focus on compliance.',
      created_at: '2024-04-15T16:35:00Z',
    },
    updated_at: '2024-04-15T16:35:00Z',
  },
  {
    id: 'thread-2',
    title: 'Northglow Agency · Kickoff',
    participants: [
      {
        id: 'participant-3',
        user: {
          email: 'zara.khan@northglow.agency',
          profile: { display_name: 'Zara Khan' },
        },
      },
      {
        id: 'participant-4',
        user: {
          email: 'ava.stone@gigvora.com',
          profile: { display_name: 'Ava Stone' },
        },
      },
    ],
    last_message: {
      body: 'Sharing the kickoff deck so the extended team can review ahead of Monday.',
      created_at: '2024-04-14T09:10:00Z',
    },
    updated_at: '2024-04-14T09:10:00Z',
  },
]

const mockMessagesByThread = {
  'thread-1': [
    {
      id: 'message-1',
      sender: { email: 'ava.stone@gigvora.com', profile: { display_name: 'Ava Stone' } },
      body: 'Sharing the compliance-ready flows we discussed – let me know if legal has edits.',
      created_at: '2024-04-15T16:05:00Z',
    },
    {
      id: 'message-2',
      sender: { email: 'mateo.silva@aurora-fintech.com', profile: { display_name: 'Mateo Silva' } },
      body: 'This is perfect. We can roll it into our UAT tomorrow.',
      created_at: '2024-04-15T16:35:00Z',
    },
  ],
  'thread-2': [
    {
      id: 'message-3',
      sender: { email: 'zara.khan@northglow.agency', profile: { display_name: 'Zara Khan' } },
      body: 'Agenda: align on milestones, confirm research inputs, outline quick wins.',
      created_at: '2024-04-14T08:20:00Z',
    },
    {
      id: 'message-4',
      sender: { email: 'ava.stone@gigvora.com', profile: { display_name: 'Ava Stone' } },
      body: 'Looks great – I will circulate this with the async recap.',
      created_at: '2024-04-14T09:10:00Z',
    },
  ],
}

const mockSearchResults = [
  {
    id: 'search-1',
    title: 'Ava Stone · Product Designer',
    description: 'Community-first product designer building trust-first experiences.',
  },
  {
    id: 'search-2',
    title: 'Aurora Fintech',
    description: 'Payments compliance platform hiring now.',
  },
]

const mockCompaniesExpanded = mockCompanies.map((company, index) => ({
  id: company.id,
  brand_name: company.brand_name,
  legal_name: `${company.brand_name} Group`,
  updated_at: '2024-04-13T10:00:00Z',
  jobs_count: [18, 9, 6][index],
}))

const defaultEmpty = { data: [] }

export function getMockApiResponse(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const url = new URL(path, 'https://mock.gigvora.local')
  const { pathname, searchParams } = url

  if (method === 'GET') {
    if (pathname === '/auth/me') return clone(mockUser)
    if (pathname.startsWith('/profiles/')) return clone(mockProfile)
    if (pathname === '/notifications') return clone({ data: mockNotifications })
    if (pathname === '/posts') return clone({ data: mockFeedPosts })
    if (pathname === '/feed/analytics/health') return clone(mockMetrics)
    if (pathname === '/suggestions') {
      const target = searchParams.get('for')
      if (target === 'people') return clone({ data: mockPeople })
      if (target === 'groups') return clone({ data: mockGroups })
      if (target === 'companies') return clone({ data: mockCompanies })
      if (target === 'projects') return clone({ data: mockProjects })
      if (target === 'gigs') return clone({ data: mockGigs })
      if (target === 'jobs') return clone({ data: mockJobs })
      return clone(defaultEmpty)
    }
    if (pathname === '/connections' || pathname === '/connections/requested') return clone(mockConnections)
    if (pathname === '/projects') return clone({ data: mockProjects })
    if (pathname === '/gigs') return clone({ data: mockGigs })
    if (pathname === '/jobs') return clone({ data: mockJobs })
    if (pathname.includes('/portfolio')) return clone({ data: mockPortfolio })
    if (pathname === '/escrow') return clone(mockEscrow)
    if (pathname === '/disputes') return clone({ data: mockDisputes })
    if (pathname === '/payments/ledger') return clone({ data: mockLedger })
    if (pathname === '/payments/payouts' || pathname === '/payouts') return clone({ data: mockPayouts })
    if (pathname === '/earnings') return clone(mockEarnings)
    if (pathname === '/agencies') return clone({ data: mockAgencies })
    if (pathname === '/companies') return clone({ data: mockCompaniesExpanded })
    if (pathname === '/interviews')
      return clone({
        data: mockJobs.map((job, index) => ({
          id: `interview-${index + 1}`,
          job: job.title,
          candidate: mockPeople[index % mockPeople.length].display_name,
          stage: ['Screen', 'Panel', 'Offer'][index % 3],
          scheduled_at: '2024-04-17T10:00:00Z',
        })),
      })
    if (pathname === '/invoices') return clone({ data: mockInvoices })
    if (pathname === '/marketplace') return clone({ data: mockMarketplace })
    if (pathname === '/networking/lobbies') return clone({ data: mockLobbies })
    if (pathname === '/groups') return clone({ data: mockGroups })
    if (pathname === '/calendar/events') return clone({ data: mockEvents })
    if (pathname === '/support/tickets') return clone({ data: mockTickets })
    if (pathname === '/settings/account') return clone(mockSettings.account)
    if (pathname === '/settings/security') return clone(mockSettings.security)
    if (pathname === '/settings/notifications') return clone(mockSettings.notifications)
    if (pathname === '/search') return clone({ data: mockSearchResults })
    if (pathname === '/admin/analytics/kpis')
      return clone({
        gross_merchandise_volume: 4280000,
        active_users: 12680,
        verified_creators: 2860,
        disputes_open: 4,
      })
    if (pathname === '/users') return clone({ data: mockUsers })
    if (pathname === '/admin/orgs') return clone({ data: mockOrgs })
    if (pathname === '/admin/reports') return clone({ data: mockReports })
    if (pathname === '/admin/audit') return clone({ data: mockAudit })
    if (pathname === '/conversations/conversations') return clone({ data: mockThreads })

    const segments = pathname.split('/').filter(Boolean)
    if (segments.length === 4 && segments[0] === 'conversations' && segments[1] === 'conversations' && segments[3] === 'messages') {
      const threadId = segments[2]
      const messages = mockMessagesByThread[threadId] || []
      return clone({ data: messages })
    }

    return clone(defaultEmpty)
  }

  if (method === 'POST') {
    if (pathname === '/posts' || pathname === '/projects' || pathname === '/gigs' || pathname === '/jobs' || pathname === '/groups') {
      const payload = options.body ? JSON.parse(options.body) : {}
      return clone({ id: `mock-${Date.now()}`, ...payload })
    }
    if (pathname.endsWith('/messages')) {
      const segments = pathname.split('/').filter(Boolean)
      const threadId = segments[2]
      const payload = options.body ? JSON.parse(options.body) : {}
      const newMessage = {
        id: `message-${Date.now()}`,
        sender: { email: mockUser.user.email, profile: { display_name: mockUser.user.name } },
        body: payload.body || '',
        created_at: new Date().toISOString(),
      }
      if (!mockMessagesByThread[threadId]) {
        mockMessagesByThread[threadId] = []
      }
      mockMessagesByThread[threadId].push(newMessage)
      return clone(newMessage)
    }
    if (pathname === '/connections/request') {
      return clone({ status: 'requested' })
    }
    return clone({ status: 'ok' })
  }

  if (method === 'PUT' || method === 'PATCH') {
    return clone({ status: 'updated' })
  }

  if (method === 'DELETE') {
    return clone({ status: 'deleted' })
  }

  return null
}

export default getMockApiResponse
