# BetPlatform

> **Demo project** — No real money, no real gambling. Built to demonstrate backend architecture patterns for high-traffic, compliance-heavy web platforms.

**Live demo:** [betplatform.robertolongo.dev](https://betplatform.robertolongo.dev)  
**Portfolio:** [robertolongo.dev](https://robertolongo.dev)  
**Author:** Roberto Longo — [linkedin.com/in/robertolongo-in](https://linkedin.com/in/robertolongo-in)

---

## What this project demonstrates

BetPlatform simulates the backend architecture of an enterprise gambling platform. The goal is not to build a real casino — it is to show that I can reason about and implement the engineering patterns that such systems require: security, compliance, real-time data, and financial integrity.

Each architectural decision is documented below with the problem it solves and the tradeoffs considered.

---

## Architecture

```
Browser
  └── Next.js (Vercel) — apps/web

Cloudflare Worker (geo-worker)
  └── Edge geoblocking — requests from unlicensed jurisdictions
      never reach the API server

Fastify API (Railway) — apps/api
  ├── JWT auth with refresh token rotation
  ├── Rate limiting (global + per-endpoint)
  ├── WebSocket real-time odds feed
  ├── Responsible gambling enforcement
  └── Audit logging

PostgreSQL (Railway)
  └── Users, refresh tokens, sessions, deposit limits, audit log

Redis (Railway)
  └── Session cache, rate limit counters, odds cache
```

**Monorepo structure (pnpm workspaces):**

```
betplatform/
  apps/api              ← Fastify + TypeScript + Prisma
  apps/web              ← Next.js frontend
  packages/types        ← Shared TypeScript interfaces
  cloudflare/geo-worker ← Cloudflare Worker
```

---

## Technical decisions

### 1. Geoblocking at the edge, not the application layer

**Problem:** Most platforms implement geo-restrictions inside the application. Restricted traffic still reaches the server, consuming CPU, database connections, and bandwidth.

**Decision:** Geoblocking runs in a Cloudflare Worker — before the request reaches Railway. The Worker reads the `CF-IPCountry` header (added automatically by Cloudflare) and returns 403 immediately for unlicensed jurisdictions.

**Result:** Zero infrastructure exposure from restricted traffic. Block latency drops from 200–500ms (application layer) to 5–10ms (edge).

**Why ALLOWED_COUNTRIES is a static set, not an env var:** Runtime misconfiguration of a compliance-critical list is a worse failure mode than requiring a redeploy to change it.

---

### 2. JWT with refresh token rotation

**Problem:** Standard JWT implementations issue long-lived tokens with no revocation mechanism. If a user self-excludes or is compromised, the token remains valid until natural expiry — which can be days.

**Decision:** Two-token model:
- `accessToken` — 15 minutes, verified via cryptographic signature only (no database)
- `refreshToken` — 7 days, stored in PostgreSQL, rotated on every use

On refresh: the old token is immediately invalidated before the new pair is issued. If a stolen token is replayed after the legitimate client has already rotated it, the server detects the reuse and revokes all tokens for that user.

**Why 15 minutes for the access token:** In a gambling context, self-exclusion must be effective within minutes, not hours. 15 minutes is the maximum window between exclusion and enforcement. This balances security with database load — only the refresh endpoint hits PostgreSQL.

---

### 3. Responsible gambling as a technical enforcement layer

**Problem:** Most platforms implement responsible gambling as policy, not as code. Self-exclusion exists as a UI toggle that can be reversed. Session limits exist on paper but are not enforced server-side.

**Decision:** Three mechanisms enforced at the API layer:

**Session timeout (4 hours):** A `preHandler` hook runs on every authenticated request. If `loginAt` (from Redis, falling back to PostgreSQL) exceeds 4 hours, all refresh tokens are revoked atomically and the session is terminated with a specific error code.

**Self-exclusion:** Implemented as a single `prisma.$transaction` with four operations — user update, token revocation, session close, audit log write. Either all four succeed or none do. A self-excluded user cannot log in regardless of correct credentials.

**Deposit limits with cooling-off period:** Decreasing a limit is immediate. Increasing requires a 7-day cooling-off period — a deliberate friction to prevent impulsive decisions during losing sessions. This is an explicit UKGC requirement.

---

### 4. Redis as session cache, not source of truth

**Problem:** Verifying session state (self-exclusion, session duration) on every authenticated request would create unsustainable PostgreSQL load at scale.

**Decision:** Session data is written to Redis on login and read on every request. PostgreSQL remains the authoritative source. If Redis is unavailable, all reads fall back to PostgreSQL transparently — the client sees slightly higher latency, not an error.

**Why this matters:** Redis failure cannot cause incorrect authorization decisions. A self-excluded user cannot gain access because Redis is down — the fallback always reads from the authoritative store.

---

### 5. WebSocket authentication at the HTTP handshake

**Problem:** WebSocket connections are long-lived. A user who self-excludes mid-session would remain connected until they close the browser if exclusion is only checked at connection time.

**Decision:** Two-layer approach:
1. JWT verified at the HTTP upgrade handshake — connection refused immediately if invalid
2. Heartbeat every 5 minutes re-checks `selfExcluded` from Redis (PostgreSQL fallback) — connection closed with code 1008 if the user has been excluded since connecting

The server is the sole source of truth for odds data. Any messages sent by the client are silently discarded.

---

### 6. Audit log as compliance infrastructure

**Problem:** In regulated gambling, every sensitive action must be traceable. Disputes, regulatory audits, and fraud investigations all require a complete, immutable history.

**Decision:** `AuditService.log()` is fire-and-forget — it never throws, never blocks the request, and catches all errors silently. Audit logging failure should never cause a user-facing error.

Events logged: `LOGIN`, `LOGOUT`, `REGISTER`, `REFRESH_TOKEN`, `FAILED_LOGIN`, `SELF_EXCLUSION`, `DEPOSIT_LIMIT_SET`, `DEPOSIT_LIMIT_PENDING`, `SESSION_TIMEOUT`, `TOKEN_REVOKED`.

`FAILED_LOGIN` includes `metadata.reason: "invalid_password" | "email_not_found"` for security analysis, but both cases return the same `"Invalid credentials"` response to prevent account enumeration.

---

### 7. PostgreSQL over MongoDB for financial data

**Decision:** PostgreSQL with full ACID guarantees. Every financial operation uses `prisma.$transaction` with `SELECT FOR UPDATE` to prevent race conditions.

**Why not MongoDB:** MongoDB's eventual consistency model creates windows of inconsistency that are unacceptable for financial transactions. No compliance audit would accept an eventually-consistent database for deposit and withdrawal operations.

---

## Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Runtime | Node.js | Non-blocking I/O ideal for WebSocket-heavy workloads |
| Framework | Fastify | Native OpenAPI integration, schema-first validation, faster than Express |
| Language | TypeScript (strict) | Type safety across shared packages eliminates API contract drift |
| Database | PostgreSQL + Prisma | ACID transactions required for financial data |
| Cache | Redis (ioredis) | Sub-millisecond session reads, TTL-native rate limiting |
| Edge | Cloudflare Workers | Zero-infrastructure geoblocking, direct CF-IPCountry header access |
| Frontend | Next.js 14 | App Router, SSR for authenticated pages, Vercel-native deployment |
| Monorepo | pnpm workspaces | Shared TypeScript types between API and web without duplication |

---

## API documentation

Interactive API documentation available at:  
`https://betplatform.robertolongo.dev/docs`

Built automatically from Fastify JSON schemas via `@fastify/swagger` — no manual documentation maintenance.

---

## Local setup

### Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- Docker Desktop

### Steps

```bash
# Clone
git clone https://github.com/roberto-longo-dev/betplatform
cd betplatform

# Install dependencies
pnpm install

# Start PostgreSQL and Redis
docker-compose up -d

# Copy environment variables
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env and fill in JWT secrets

# Run database migrations
cd apps/api && npx prisma migrate dev

# Seed demo user
pnpm --filter api seed

# Start API (port 3001)
cd apps/api && pnpm dev

# Start frontend (port 3000) — in a separate terminal
cd apps/web && pnpm dev
```

### Test the WebSocket locally

```bash
# Cloudflare Worker (port 8787)
cd cloudflare/geo-worker && npx wrangler dev

# Test geoblocking
curl -H "CF-IPCountry: US" http://localhost:8787/test
# → 403 {"error":"Service not available in your region","country":"US"}

curl -H "CF-IPCountry: IT" http://localhost:8787/health
# → 200 {"status":"ok"}
```

---

## Compliance note

This is a portfolio demonstration project. In a production deployment, this platform would require: GDPR-compliant privacy policy and cookie consent, gambling licenses per jurisdiction, KYC provider integration, accessibility statement (WCAG 2.1 AA), and certified responsible gambling tooling.

---

## Author

**Roberto Longo** — Full-Stack Engineer  
5 years enterprise backend experience with strong experience as Tech Lead.  
Specializing in backend systems, edge infrastructure, and cloud-native architectures.

[robertolongo.dev](https://robertolongo.dev) · [linkedin.com/in/robertolongo-in](https://linkedin.com/in/robertolongo-in) · [github.com/roberto-longo-dev](https://github.com/roberto-longo-dev)