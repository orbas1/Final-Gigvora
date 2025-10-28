Versioning & Conventions

Base URL: /api/v1

Auth: Bearer (JWT) or session cookie; admin endpoints require role=admin.

Common query: ?cursor=&limit=&sort=&q=&fields=&expand=

Soft delete where noted (deleted_at), use ?include=deleted for admins.

All list endpoints support ?analytics=true to append light summary counts where indicated.

Auth (/auth/*)

POST /auth/register — body: email, password, role; optional org.

POST /auth/login

POST /auth/refresh

POST /auth/logout

POST /auth/forgot

POST /auth/reset

POST /auth/verify-email — token

POST /auth/otp — send OTP (SMTP)

POST /auth/2fa/setup • POST /auth/2fa/verify • DELETE /auth/2fa

GET /auth/me

POST /auth/switch-role — role/org_id

Analytics: GET /auth/analytics/registrations?from=&to=&by=day|week|month

Users (/users)

GET /users — search: q, skills, location, role, verified, created_between

POST /users — (admin create)

GET /users/:id

PATCH /users/:id — self/admin

DELETE /users/:id — soft delete

Actions:
POST /users/:id/follow • DELETE /users/:id/follow
POST /users/:id/block • DELETE /users/:id/block
POST /users/:id/report

Collections: GET /users/:id/followers • GET /users/:id/following

Analytics:
GET /users/:id/analytics/overview (profile views, follows, messages, posts)
GET /users/analytics/retention?cohort=week&from=&to=
GET /users/analytics/actives?granularity=day

Profiles (/profiles)

Person profile

GET /profiles/:userId • PATCH /profiles/:userId

Subresources:

Experience: GET|POST /profiles/:userId/experience • GET|PATCH|DELETE /profiles/:userId/experience/:expId

Education: GET|POST .../education • GET|PATCH|DELETE .../education/:eduId

Skills: GET|POST|DELETE /profiles/:userId/skills (bulk upsert)

Tags: GET|POST|DELETE /profiles/:userId/tags

Portfolio: GET|POST /profiles/:userId/portfolio • PATCH|DELETE /profiles/:userId/portfolio/:itemId

Reviews: GET /profiles/:userId/reviews • POST /profiles/:userId/reviews (after engagement)

Freelancer/Agency/Company overlays

Freelancer: GET|PATCH /profiles/:userId/freelancer

Agency: GET|PATCH /profiles/agency/:orgId

Company: GET|PATCH /profiles/company/:orgId

Analytics:
GET /profiles/:id/analytics/traffic?from=&to=&by=
GET /profiles/:id/analytics/engagement (follows, messages, views)
GET /profiles/analytics/top?metric=views|follows&from=&to=

Connections (/connections)

GET /connections?userId=&status=pending|accepted

POST /connections/request — to_user_id, note?

POST /connections/accept — connection_id

POST /connections/reject — connection_id

DELETE /connections/:id

Analytics: GET /connections/analytics/network-growth?userId=&from=&to=&by=

Posts / Comments / Reactions / Shares

Posts:

GET /posts?feed=home|profile|company|group&author_id=&org_id=&cursor=

POST /posts — content, attachments[], share_ref (project/gig/job/profile)

GET /posts/:id

PATCH /posts/:id

DELETE /posts/:id

Comments:

GET /posts/:postId/comments?cursor=

POST /posts/:postId/comments — content, parent_id?

PATCH /comments/:id

DELETE /comments/:id

Reactions:

POST /posts/:id/reactions — type

DELETE /posts/:id/reactions?type=

GET /posts/:id/reactions?grouped=true

Shares:

POST /posts/:id/share

Analytics:
GET /posts/analytics/trending?window=24h
GET /posts/:id/analytics (views, reach, reactions, comments, shares)
GET /feed/analytics/health?from=&to= (latency, errors if tracked)

Messages / Conversations (with RT events)

Conversations:

GET /conversations?cursor=&participant_id=

POST /conversations — participants[]

GET /conversations/:id

PATCH /conversations/:id — title, pinned, archived

DELETE /conversations/:id

Messages:

GET /conversations/:id/messages?cursor=

POST /conversations/:id/messages — text, attachments[]

PATCH /messages/:id — edit window guard

DELETE /messages/:id

POST /messages/:id/read

Real-time (Socket events): conversation:created, message:new, message:edit, message:read, typing, presence

Analytics: GET /messages/analytics/volume?from=&to=&by=&scope=user|org|platform

Groups (/groups)

GET /groups?q=&tags=&cursor=

POST /groups

GET /groups/:id

PATCH /groups/:id

DELETE /groups/:id

Membership:

POST /groups/:id/join • POST /groups/:id/leave

GET /groups/:id/members?role=member|mod|owner

PATCH /groups/:id/members/:userId — role changes (mod/owner)

Group posts reuse /posts with group_id scope.

Analytics: GET /groups/:id/analytics (members, posts, growth)

Orgs (Companies / Agencies)

Companies:

GET /companies?q=&verified=&cursor=

POST /companies (org create)

GET /companies/:id

PATCH /companies/:id

DELETE /companies/:id

Employees: GET /companies/:id/employees • POST /companies/:id/employees • DELETE /companies/:id/employees/:userId

Agencies (mirror Companies): /agencies with /agencies/:id/team

Analytics:
GET /companies/:id/analytics/profile
GET /agencies/:id/analytics/profile

Jobs / ATS / Interviews / Scorecards

Jobs:

GET /jobs?q=&company_id=&location=&tags=&salary_min=&type=&cursor=

POST /jobs (company/agency role)

GET /jobs/:id

PATCH /jobs/:id

DELETE /jobs/:id

Applications:

GET /jobs/:id/applications?stage=&cursor=

POST /jobs/:id/applications — resume_url | parsed fields

GET /applications/:id

PATCH /applications/:id — status, notes, tags

DELETE /applications/:id

ATS:

Stages: GET|POST /jobs/:id/stages • PATCH|DELETE /jobs/:id/stages/:stageId

Move: POST /applications/:id/move — to_stage_id

Tags: POST|DELETE /applications/:id/tags

Scorecards: GET|POST /applications/:id/scorecards • PATCH|DELETE /scorecards/:scorecardId

Interviews:

GET /interviews?job_id=&application_id=&cursor=

POST /interviews — schedule, panel, link to Live

GET /interviews/:id • PATCH /interviews/:id • DELETE /interviews/:id

Feedback: POST /interviews/:id/feedback

Analytics:
GET /jobs/:id/analytics (views, applies, conversion)
GET /ats/analytics/funnel?job_id=
GET /interviews/analytics/load?from=&to=

Marketplace — Projects / Gigs / Milestones / Deliverables

Projects:

GET /projects?q=&owner_id=&status=&type=fixed|hourly&tags=&cursor=

POST /projects

GET /projects/:id

PATCH /projects/:id

DELETE /projects/:id

Invites: POST /projects/:id/invites • GET /projects/:id/invites

Bids/Proposals: POST /projects/:id/bids • GET /projects/:id/bids • PATCH /bids/:id • DELETE /bids/:id

Milestones: GET|POST /projects/:id/milestones • PATCH|DELETE /milestones/:id

Deliverables: GET|POST /projects/:id/deliverables • PATCH|DELETE /deliverables/:id

Time logs (hourly): GET|POST /projects/:id/timelogs • PATCH|DELETE /timelogs/:id

Reviews: GET /projects/:id/reviews • POST /projects/:id/reviews

Gigs:

GET /gigs?q=&seller_id=&tags=&price_min=&price_max=&cursor=

POST /gigs

GET /gigs/:id

PATCH /gigs/:id

DELETE /gigs/:id

Packages: GET|POST /gigs/:id/packages • PATCH|DELETE /packages/:id (exactly 3 tiers)

Addons & FAQ: GET|POST /gigs/:id/addons|/faq • PATCH|DELETE /addons/:id|/faq/:id

Media: POST /gigs/:id/media • DELETE /gigs/:id/media/:mediaId

Orders: GET /gigs/:id/orders • POST /gigs/:id/orders • GET|PATCH /orders/:id • POST /orders/:id/cancel

Submissions: GET|POST /orders/:id/submissions • PATCH /submissions/:id

Reviews: GET /orders/:id/reviews • POST /orders/:id/reviews

Analytics:
GET /projects/analytics/revenue?from=&to=&group_by=day|org|user
GET /gigs/analytics/sales?from=&to=
GET /gigs/:id/analytics (views, CTR, orders, AOV)

Payments / Wallet / Escrow / Payouts / Refunds / Ledger

Wallet & Methods:

GET /wallet — balances (proxy from PSP)

GET /wallet/methods • POST /wallet/methods • DELETE /wallet/methods/:id

Payout accounts: GET|POST|DELETE /wallet/payout-accounts

Escrow-like (PSP-backed):

POST /escrow — create intent (project_milestone|gig_order), amount, currency

GET /escrow/:id — status

POST /escrow/:id/capture — on acceptance/delivery

POST /escrow/:id/cancel — before capture

POST /escrow/:id/refund — partial/full

POST /escrow/:id/hold / POST /escrow/:id/release — flags around dispute

Payouts & Refunds:

GET|POST /payouts • GET /payouts/:id

GET|POST /refunds • GET /refunds/:id

Ledger & Invoices:

GET /payments/ledger?entity_type=&entity_id=&from=&to=&cursor=

GET /invoices?entity_type=&entity_id=&cursor= • GET /invoices/:id (PDF link)

Webhooks (inbound from PSP):

POST /payments/webhook — idempotent

Analytics:
GET /payments/analytics/gmv?from=&to=&by=
GET /payments/analytics/take-rate?from=&to=
GET /payments/analytics/disputes-rate?from=&to=

Disputes (/disputes)

GET /disputes?entity_type=project|order&status=&cursor=

POST /disputes — entity_ref, reason, details

GET /disputes/:id

PATCH /disputes/:id — status transitions

Messages/Evidence:

GET|POST /disputes/:id/messages

GET|POST /disputes/:id/evidence

Settlements:

POST /disputes/:id/settlements — partial/full

Decisions:

POST /disputes/:id/decision — admin/mod only

Analytics: GET /disputes/analytics?from=&to=&by=&status=

Search (/search)

GET /search?q=&type=people|freelancers|agencies|companies|projects|gigs|jobs|groups&location=&skills=&tags=&cursor=

Suggest: GET /search/suggestions?q=&type=skills|tags|titles|companies

Recommendations (/suggestions)

GET /suggestions?for=feed|people|groups|companies|projects|gigs|jobs&user_id=

Optional explore feed blending: GET /suggestions/explore?cursor=

Speed Networking / Live (/networking, /live)

Lobbies:

GET /networking/lobbies?duration=2|5&paid=bool&topic=

POST /networking/lobbies (admin/mod create)

Sessions:

POST /networking/sessions — join lobby

GET /networking/sessions/:id — status, peer info (masked)

POST /networking/sessions/:id/leave

POST /networking/sessions/:id/rate — stars, note

Live video signaling (WebRTC/Socket sidecar if needed):

POST /live/signaling/offer • POST /live/signaling/answer • POST /live/signaling/ice

Analytics: GET /networking/analytics/usage?from=&to=&by=&duration=

Calendar (/calendar)

GET /calendar/events?from=&to=&scope=user|org

POST /calendar/events

GET /calendar/events/:id • PATCH|DELETE /calendar/events/:id

ICS & Integrations:

GET /calendar/ics?token=

POST /calendar/integrations — provider connect

DELETE /calendar/integrations/:provider

Analytics: GET /calendar/analytics/busy-hours?from=&to=&by=hour

Reviews & Ratings (/reviews)

Generic create for subject types:

POST /reviews — {subject_type: project|order|profile, subject_id, rating, comment}

GET /reviews?subject_type=&subject_id=&cursor=

DELETE /reviews/:id (mod/self if policy allows)

Analytics: GET /reviews/analytics/averages?subject_type=&subject_id=

Files & Media (/files)

POST /files — returns signed URL or handle; virus scan kickoff

GET /files/:id — gated access, signed redirect

DELETE /files/:id

Analytics: GET /files/analytics/storage?owner_id=&from=&to=

Tags & Skills (/tags, /skills)

Tags: GET|POST /tags • PATCH|DELETE /tags/:id (admin for canonical)

Skills: GET|POST /skills • PATCH|DELETE /skills/:id (admin)

Autocomplete: GET /tags/suggest?q= • GET /skills/suggest?q=

Notifications (/notifications)

GET /notifications?cursor=&unread_only=

PATCH /notifications/:id/read

PATCH /notifications/read-all

Channels prefs: GET|PATCH /notifications/preferences

Analytics: GET /notifications/analytics/delivery?from=&to=

Verification (KYC/KYB) (/verification)

POST /verification/start — user/org

GET /verification/status?subject_type=user|org&subject_id=

Webhooks: POST /verification/webhook (provider -> platform)

Support / Tickets (/support)

GET /support/tickets?cursor=&status=

POST /support/tickets

GET /support/tickets/:id • PATCH /support/tickets/:id • POST /support/tickets/:id/messages

Analytics: GET /support/analytics/sla?from=&to=&by=

Settings (/settings)

Account: GET|PATCH /settings/account

Security: GET|PATCH /settings/security (password change, devices)

Privacy: GET|PATCH /settings/privacy

Notifications: GET|PATCH /settings/notifications

Payments: GET|PATCH /settings/payments

Theme tokens (per-user): GET|PATCH /settings/theme

API Tokens: GET|POST|DELETE /settings/api-tokens

Admin (/admin/*)

Overview: GET /admin/overview?from=&to=

Users: GET /admin/users • PATCH /admin/users/:id (ban, verify, role) • POST /admin/users/:id/impersonate

Orgs: GET /admin/orgs • PATCH /admin/orgs/:id (verify, merge)

Content: GET /admin/reports • POST /admin/reports/:id/action

Marketplace: GET|PATCH /admin/marketplace/config (categories, floors, fees)

Jobs: GET /admin/jobs • PATCH /admin/jobs/:id (sponsor, hide)

Payments: GET /admin/payments/ledger • POST /admin/payouts/:id/approve • POST /admin/refunds/:id/approve

Disputes: GET /admin/disputes • POST /admin/disputes/:id/decide

Moderation: GET /admin/moderation/strikes • POST /admin/moderation/strikes • PATCH /admin/moderation/strikes/:id

Settings: GET|PATCH /admin/settings (email templates, roles, integrations)

Audit: GET /admin/audit?actor=&entity=&from=&to=&cursor=

Earnings: GET /admin/earnings?from=&to=&by=product|day|org

Analytics (platform-wide):
GET /admin/analytics/kpis?from=&to= (MAU, DAU, GMV, take-rate, message volume)
GET /admin/analytics/cohorts?from=&to=&cohort=week
GET /admin/analytics/search?from=&to= (top queries, zero-result rate)

Legal & Policies (/legal)

GET /legal/terms • GET /legal/privacy • GET /legal/refunds • GET /legal/guidelines

Consent logs: GET|POST /legal/consents • GET /legal/consents/:id

Outbound Webhooks (/webhooks)

Registrations: GET|POST|DELETE /webhooks — (your customers can subscribe)

Deliveries: GET /webhooks/deliveries?status=&cursor=

Error & Rate-Limit Shapes (recommendation)

Errors: RFC7807 Problem+JSON { type, title, status, detail, instance, code }

Rate-Limits: 429 with headers X-RateLimit-Limit/Remaining/Reset.

Idempotency (payments/mutations)

Accept Idempotency-Key for POST /escrow, /payouts, /refunds, /orders, /bids, /messages.

Soft Deletes & Undelete

Where supported: DELETE sets deleted_at; admin restore via POST /admin/restore with {entity_type, id}.