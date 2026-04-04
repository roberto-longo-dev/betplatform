# betplatform

A sports betting platform backend built as a portfolio project to demonstrate production-grade Node.js engineering. The backend is the focus; the UI is intentionally minimal.

## Architecture

Monorepo managed with [pnpm workspaces](https://pnpm.io/workspaces).

| Package | Stack | Deploy target |
|---|---|---|
| `apps/api` | Fastify, TypeScript, Prisma, PostgreSQL | Railway |
| `apps/web` | Next.js (minimal) | Vercel |
| `packages/types` | Shared TypeScript interfaces | — |
| `cloudflare/geo-worker` | Cloudflare Worker | Cloudflare Workers |

## Why these choices?

### Fastify over Express

Fastify is measurably faster (~10× in JSON-heavy benchmarks), but the performance story is secondary. The real reason is **schema-first design**: every route declares a JSON Schema that Fastify uses simultaneously for request validation *and* for generating OpenAPI documentation via `@fastify/swagger`. With Express you'd reach for separate libraries (`joi`/`zod`, `swagger-jsdoc`) that inevitably drift from each other. Fastify keeps validation and docs in sync by construction.

TypeScript support is also first-class — the generic `fastify.post<{ Body: T }>` pattern gives full type inference on `request.body` without extra middleware.

### JWT refresh token rotation

A single long-lived JWT is a footgun: if it leaks, an attacker has persistent access with no revocation path.

This project uses a two-token model:

| Token | Format | TTL | Storage |
|---|---|---|---|
| Access token | Signed JWT | 15 minutes | Client memory |
| Refresh token | Opaque random hex | 7 days | PostgreSQL |

Key properties:
- **Revocable** — refresh tokens are rows in the DB. Logout, password change, or suspicious activity can invalidate them immediately.
- **Rotation** — each `/auth/refresh` call marks the submitted token as `revokedAt` before issuing a new pair. If a stolen token is replayed after the legitimate client has already rotated it, the server sees a revoked token and can reject it (and optionally flag the account).
- **Timing-safe login** — `bcrypt.compare` always runs regardless of whether the email exists, preventing user enumeration via response timing.

### Monorepo with pnpm workspaces

`packages/types` holds shared request/response interfaces consumed by both the API and the web app — one source of truth, no copy-paste drift. pnpm's strict lockfile and symlink-based `node_modules` prevent phantom dependencies (packages that work locally because they happen to be installed by a sibling, but break in CI).

## Local setup

### Prerequisites

- Node.js 20+
- pnpm 9+ (`corepack enable` or `npm i -g pnpm`)
- PostgreSQL 16+

### Install

```bash
corepack enable
pnpm install
```

### Database

```bash
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env — set DATABASE_URL and JWT_SECRET
pnpm --filter @betplatform/api db:migrate
```

### Run

```bash
# API on port 3001
pnpm dev:api

# Web on port 3000 (optional)
pnpm dev:web
```

### API documentation

Visit **http://localhost:3001/docs** for the interactive Swagger UI.

## Endpoints

| Method | Path | Description | Rate limit |
|---|---|---|---|
| GET | `/health` | Health check | 100/min |
| POST | `/auth/register` | Create account | 5/min |
| POST | `/auth/login` | Login, receive token pair | 5/min |
| POST | `/auth/refresh` | Rotate refresh token | 5/min |
| POST | `/auth/logout` | Revoke refresh token | 5/min |

## Roadmap

- [ ] Cloudflare Worker geoblocking
- [ ] Redis session cache
- [ ] WebSocket real-time odds feed
- [ ] Responsible gambling: session timeout, self-exclusion endpoint, deposit limits
