# Jelall Backend Setup

## 1) Install dependencies
```bash
npm install
```

## 2) Configure environment
Copy `.env.example` to `.env` and fill in your PostgreSQL credentials and JWT secret.

## 3) Create database
Create a PostgreSQL database named in `DB_NAME` (default: `jelall`).

## 4) Run schema + seed
```bash
npm run db:setup
```

## 5) Start server
```bash
npm run dev
```

Server runs on `http://localhost:4000` by default.

## Production Security
Set these required environment variables in production:

- `NODE_ENV=production`
- `JWT_SECRET` (minimum 32 chars)
- `SESSION_SECRET` (minimum 32 chars, different from JWT secret)
- `CORS_ORIGINS=https://jelall.com,https://www.jelall.com`

Recommended hardening variables:

- `JWT_EXPIRES_IN=12h`
- `LOGIN_RATE_LIMIT_MAX=8`
- `SEND_CODE_RATE_LIMIT_MAX=6`
- `LOGIN_LOCKOUT_ATTEMPTS=5`
- `LOGIN_LOCKOUT_MS=900000`
- `CAPTCHA_SITE_KEY` + `CAPTCHA_SECRET` (Cloudflare Turnstile)
- `ALERT_WEBHOOK_URL` (optional: Slack/Discord/custom)

## Backups
Create a PostgreSQL backup:

```bash
npm run db:backup
```

Restore a backup:

```bash
npm run db:restore -- database/backups/your-backup.dump
```

Requires `pg_dump` and `pg_restore` available in your shell PATH.

## Monitoring APIs
- `GET /api/health` basic health and DB latency
- `POST /api/metrics/events` funnel event ingestion
- `POST /api/metrics/errors` client error ingestion
- `POST /api/metrics/uptime` admin uptime check ingestion
- `GET /api/metrics/funnel` admin funnel dashboard data
- `GET /api/metrics/errors` admin recent errors
- `GET /api/metrics/uptime` admin uptime summary
