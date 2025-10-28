# Gigvora API Backend

This Express.js service provides the Gigvora API following the `/api/v1` namespace. It includes authentication, user management, profiles, connections, posts, notifications, files, settings, support, verification, webhooks, and admin utilities with MySQL (or SQLite) persistence via Sequelize.

## Getting Started

```bash
cp .env.example .env
mkdir -p storage
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

The API listens on the port defined by `PORT` (defaults to 4000). Development uses SQLite by default; configure MySQL by updating the environment variables.

### Environment profiles

| Profile      | Purpose                    | Default database                  | Notes |
|--------------|----------------------------|-----------------------------------|-------|
| `development`| Local iteration             | SQLite (`./storage/dev.sqlite`)   | Auto-sync enabled for quick setup. |
| `demo`       | Shared showcase / staging   | MySQL (`DEMO_DB_*` variables)     | Intended for stable demo data, migrations only. |
| `production` | Live deployment             | MySQL (`PROD_DB_*` variables)     | Requires migrations; auto sync disabled. |
| `test`       | Automated tests             | In-memory SQLite                  | Fast, isolated test runs. |

Set `NODE_ENV` (and optionally `DOTENV_CONFIG_PATH`) before running migrations or the server to target a profile:

```bash
NODE_ENV=demo npx sequelize db:migrate
NODE_ENV=production npm start
```

Override pool sizes, credentials, and hostnames with the prefix-specific variables shown in `.env.example` (`DEV_DB_*`, `DEMO_DB_*`, `PROD_DB_*`). Use `DB_AUTO_MIGRATE=true` only for ephemeral environments; production and demo instances should apply migrations separately.

## Tooling

- **Migrations**: `npm run db:migrate`
- **Seeders**: `npm run db:seed`
- **Reset**: `npm run db:reset`

## Key Features

- JWT authentication with refresh tokens, email verification, OTP, and 2FA.
- Role-protected admin routes with soft delete support and restore endpoints.
- Rich user, profile, connection, post, notification, file, settings, support, verification, webhook, and legal endpoints that follow the specification in `CREATE_ROUTES.md`.
- Analytics utilities that respect MySQL/SQLite/PostgreSQL dialect differences while providing consistent bucketed metrics.
- Problem+JSON error formatting, rate limiting headers, and idempotency-key handling for mutating endpoints.

Refer to `CREATE_ROUTES.md` for the complete API matrix.
