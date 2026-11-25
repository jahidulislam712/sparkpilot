# SparkPilot by DevSparkr: Build Guide

> A step-by-step, chunk-by-chunk roadmap to build **SparkPilot**, a multi-tenant AI customer-support SaaS, from an empty folder to a deployed, tested, billed production application.
>
> **Brand:** DevSparkr · **Product:** SparkPilot · **npm scope:** `@sparkpilot/*` · **Repo name:** `sparkpilot`

---

## 0. How to use this guide

Every chunk follows the same template so you can **review, test, and learn** before moving on:

| Block | Meaning |
|---|---|
| **Goal** | What you are building and why it matters |
| **Tasks** | Checklist of concrete steps |
| **Packages** | What to install (only when new) |
| **Test it** | How to prove it works (manual and automated) |
| **Done when** | Objective finish line |
| **Learn** | Concepts to understand (be able to explain them in an interview) |
| **Commit** | Suggested conventional-commit message |

**Rules for yourself**

1. One chunk = one branch = one pull request (even though you work alone). CI must be green before merge.
2. Never start the next chunk until the "Done when" list is true.
3. After each phase, write 5 to 10 lines in `docs/devlog.md`: what you built, what broke, what you learned. This becomes interview material.
4. Time estimates assume 2 to 4 focused hours per chunk. Total: about 8 to 10 weeks part-time.
5. Free tiers and package versions change. Check the official docs before installing, and pin exact versions in lockfiles.

---

## 1. Product overview

**What it does:** A business signs up, subscribes to a plan, uploads documents or crawls its website, and gets an embeddable AI support chatbot (one `<script>` tag). The bot answers from the company's own knowledge with citations, performs actions through tools (create ticket, capture lead, hand off to a human), and the owner monitors everything from a dashboard.

**Actors**

- **Platform admin** (you): sees all tenants (optional, later).
- **Organization owner/admin**: manages bots, knowledge, billing, team.
- **Support agent**: handles handed-off conversations and tickets.
- **Visitor**: an anonymous end customer chatting through the widget.

**Feature map to your AI goals**

| Goal | Where it lives |
|---|---|
| AI Support Assistant | Embeddable widget plus streaming chat |
| RAG Knowledge Assistant | Ingestion pipeline, pgvector, citations |
| AI Agent | Tool calling (tickets, leads, handoff, webhook lookups) |
| AI Workflow Automation | BullMQ jobs: summaries, sentiment, tags, digests, notifications |
| AI Business Assistant | Owner-facing analytics assistant |
| Production AI App | Auth, RBAC, billing, limits, tests, CI/CD, observability, security |

---

## 2. Architecture

```mermaid
flowchart LR
  V[Visitor website + widget.js] -->|HTTPS, SSE| API
  D[Dashboard - Next.js] -->|HTTPS, cookies| API
  API[API - Express + TS] --> PG[(PostgreSQL + pgvector)]
  API --> R[(Redis)]
  API --> S3[(Object storage)]
  API --> LLM[LLM + Embeddings providers]
  R --> W[Worker - BullMQ]
  W --> PG
  W --> S3
  W --> LLM
  W --> N[Email / Slack]
  ST[Stripe] -->|Webhooks| API
```

**Key decisions (write these up later as ADRs)**

| Decision | Choice | Why |
|---|---|---|
| Repo style | pnpm monorepo + Turborepo | Share types and schemas between API, web, widget |
| API | Express + TypeScript | You already know it; explicit and easy to test |
| ORM | Prisma | You know it; raw SQL only for vector queries |
| Vector store | pgvector inside PostgreSQL | One database, simple tenant filtering |
| Queue | BullMQ + Redis | Retries, delays, schedules, dashboards |
| Auth | Own implementation: Argon2 + JWT access + rotating refresh cookies | You learn the internals. Optionally compare with Better Auth or Auth.js later |
| Authorization | Role-based (RBAC) with a permission map, enforced by middleware | Simple, testable, enough for the product |
| Validation | Zod, schemas shared via `packages/shared` | One source of truth for FE and BE |
| Realtime | Server-Sent Events for chat streaming | Simpler than WebSockets for one-way streaming |
| Widget | Preact + Vite, Shadow DOM, single JS bundle | Tiny, style-isolated |
| Tests | Vitest, Supertest, Testcontainers, Playwright | Full pyramid |

---

## 3. Final folder structure

Build it gradually. This is where you will end up.

```
sparkpilot/
├─ apps/
│  ├─ api/                      # Express REST + SSE API
│  │  ├─ src/
│  │  │  ├─ main.ts             # process entry (starts server)
│  │  │  ├─ app.ts              # builds the express app (testable)
│  │  │  ├─ config/             # env validation, constants
│  │  │  ├─ lib/                # logger, errors, redis, s3, stripe, mailer
│  │  │  ├─ middleware/         # auth, rbac, tenant, rateLimit, validate, error
│  │  │  ├─ modules/
│  │  │  │  ├─ auth/            # routes, controller, service, tokens, schemas
│  │  │  │  ├─ organizations/
│  │  │  │  ├─ members/
│  │  │  │  ├─ bots/
│  │  │  │  ├─ knowledge/       # documents, ingestion triggers
│  │  │  │  ├─ chat/            # public widget chat + dashboard playground
│  │  │  │  ├─ agent/           # tools, tool registry, executor
│  │  │  │  ├─ conversations/
│  │  │  │  ├─ tickets/
│  │  │  │  ├─ leads/
│  │  │  │  ├─ analytics/
│  │  │  │  ├─ assistant/       # business assistant
│  │  │  │  ├─ billing/         # stripe checkout, portal, webhooks, usage
│  │  │  │  └─ health/
│  │  │  └─ ai/                 # llm client, embeddings, prompts, guardrails
│  │  ├─ tests/                 # unit/, integration/, helpers/
│  │  ├─ Dockerfile
│  │  └─ package.json
│  ├─ worker/                   # BullMQ workers (ingestion, automation, digests)
│  │  ├─ src/{main.ts, queues/, processors/}
│  │  ├─ Dockerfile
│  │  └─ package.json
│  ├─ web/                      # Next.js dashboard + marketing + hosted help page
│  │  ├─ src/
│  │  │  ├─ app/
│  │  │  │  ├─ (marketing)/     # landing, pricing
│  │  │  │  ├─ (auth)/          # login, register, verify, reset
│  │  │  │  ├─ (dashboard)/     # bots, knowledge, inbox, tickets, analytics, billing, settings
│  │  │  │  └─ help/[botKey]/   # public hosted chat page
│  │  │  ├─ components/         # ui/ (shadcn), tables/, forms/, charts/
│  │  │  ├─ lib/                # api client, query keys, auth helpers
│  │  │  └─ hooks/
│  │  ├─ e2e/                   # Playwright specs
│  │  ├─ Dockerfile
│  │  └─ package.json
│  └─ widget/                   # embeddable chat widget (Preact)
│     ├─ src/{main.tsx, ChatWindow.tsx, api.ts, styles.css}
│     └─ vite.config.ts
├─ packages/
│  ├─ db/                       # prisma schema, migrations, client, seed
│  ├─ shared/                   # zod schemas, types, constants, permissions
│  └─ config/                   # eslint, tsconfig, prettier presets
├─ docs/
│  ├─ adr/                      # architecture decision records
│  ├─ devlog.md
│  ├─ architecture.md
│  └─ api.md
├─ evals/                       # RAG evaluation set and runner
├─ .github/workflows/           # ci.yml, deploy.yml
├─ docker-compose.yml           # local dev services
├─ docker-compose.prod.yml      # production-like local run
├─ turbo.json
├─ pnpm-workspace.yaml
├─ .env.example
└─ README.md
```

---

# PHASE 0: Tooling and repository foundation

### P0-C1: Create the monorepo
**Goal:** An empty but correct workspace that every later chunk plugs into.
**Tasks**
- [ ] Install Node LTS and pnpm. `git init sparkpilot`, add `.gitignore`, `.editorconfig`, `.nvmrc`.
- [ ] Create `pnpm-workspace.yaml` with `apps/*` and `packages/*`.
- [ ] Add Turborepo with `build`, `dev`, `lint`, `test`, `typecheck` pipelines.
- [ ] Create empty packages: `packages/shared`, `packages/db`, `packages/config`.

**Packages:** `pnpm`, `turbo`, `typescript`
**Test it:** `pnpm install && pnpm turbo run typecheck` passes on empty packages.
**Done when:** Workspace installs cleanly and `pnpm -r exec pwd` lists every package.
**Learn:** Monorepos, workspace protocol (`workspace:*`), build caching.
**Commit:** `chore: bootstrap pnpm + turborepo monorepo`

### P0-C2: TypeScript, linting, formatting
**Tasks**
- [ ] `packages/config/tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, ES2022, `moduleResolution` suited to your bundler/runtime).
- [ ] Shared ESLint flat config (typescript-eslint) and Prettier config.
- [ ] Root scripts: `lint`, `format`, `typecheck`.

**Packages:** `eslint`, `typescript-eslint`, `prettier`, `eslint-config-prettier`
**Done when:** A deliberately bad file fails lint, and a fix passes.
**Learn:** Why strict TS matters, how shared configs avoid drift.
**Commit:** `chore: add shared ts/eslint/prettier config`

### P0-C3: Git hooks and commit standards
**Tasks**
- [ ] Husky pre-commit running `lint-staged`; commit-msg running `commitlint` (Conventional Commits).
- [ ] Add a PR template and issue templates in `.github/`.

**Packages:** `husky`, `lint-staged`, `@commitlint/cli`, `@commitlint/config-conventional`
**Test it:** Try committing `bad message`. It must be rejected.
**Done when:** Hooks run automatically after `pnpm install`.
**Learn:** Shift-left quality, conventional commits (and later, automated changelogs).
**Commit:** `chore: add husky, lint-staged and commitlint`

### P0-C4: Typed environment configuration
**Tasks**
- [ ] Create `.env.example` listing every variable (see Appendix B).
- [ ] In the API, validate `process.env` with Zod at startup and export a typed `env` object. The app must crash early with a clear message when a variable is missing.

**Packages:** `zod`, `dotenv`
**Test it:** Unit test: invalid env throws, valid env parses.
**Done when:** No code reads `process.env` directly except the config module.
**Learn:** Fail-fast configuration, 12-factor app basics.
**Commit:** `feat(api): validated env config`

---

# PHASE 1: Database and local infrastructure

### P1-C1: Docker Compose for local services
**Goal:** One command starts everything the app depends on.
**Tasks**
- [ ] `docker-compose.yml` with: Postgres using the `pgvector/pgvector` image, Redis, **Mailpit** (fake SMTP inbox), and **MinIO** (S3-compatible storage).
- [ ] Named volumes, healthchecks, and ports exposed only on localhost.

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: sparkpilot
      POSTGRES_PASSWORD: sparkpilot
      POSTGRES_DB: sparkpilot
    ports: ["127.0.0.1:5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U sparkpilot"]
      interval: 5s
      retries: 10
  redis:
    image: redis:7-alpine
    ports: ["127.0.0.1:6379:6379"]
  mailpit:
    image: axllent/mailpit
    ports: ["127.0.0.1:8025:8025", "127.0.0.1:1025:1025"]
  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    ports: ["127.0.0.1:9000:9000", "127.0.0.1:9001:9001"]
    volumes: [miniodata:/data]
volumes: { pgdata: {}, miniodata: {} }
```

**Test it:** `docker compose up -d`, then `psql` in and run `CREATE EXTENSION vector;`.
**Done when:** All four services are healthy and survive a restart with data intact.
**Learn:** Volumes, healthchecks, why local parity with production matters.
**Commit:** `chore: docker compose for postgres, redis, mailpit, minio`

### P1-C2: Prisma setup and core schema
**Tasks**
- [ ] In `packages/db`, install Prisma and create the schema (draft in Appendix C): `User`, `Organization`, `Membership`, `RefreshToken`, `EmailToken`.
- [ ] First migration enabling the `vector` extension.
- [ ] Export a singleton `prisma` client.

**Packages:** `prisma`, `@prisma/client`
**Test it:** `pnpm db:migrate` then `pnpm db:studio` shows the tables.
**Done when:** A script inserts and reads a user.
**Learn:** Migrations vs `db push`, indexes, unique constraints, cascading deletes.
**Commit:** `feat(db): core auth and tenancy schema`

### P1-C3: Remaining domain schema
**Tasks**
- [ ] Add `Bot`, `Document`, `Chunk` (vector column), `Conversation`, `Message`, `ToolCall`, `Ticket`, `Lead`, `Subscription`, `UsageRecord`, `AuditLog`, `WebhookEvent`.
- [ ] Add a raw-SQL migration for the HNSW index on `Chunk.embedding` and for a full-text index (`tsvector`) on `Chunk.content`.
- [ ] Every tenant-owned table has an `organizationId` and a composite index starting with it.

**Test it:** Migrate from empty database in CI-like conditions (`prisma migrate reset`).
**Done when:** Schema matches Appendix C and a seed script creates one demo org.
**Learn:** Vector dimensions, HNSW vs IVFFlat, why every tenant table needs `organizationId`.
**Commit:** `feat(db): domain schema with vector and fts indexes`

### P1-C4: Seed data
**Tasks**
- [ ] Idempotent `seed.ts`: demo org, owner user, one bot, sample documents (used later by e2e and demo).

**Done when:** Running seed twice does not create duplicates.
**Commit:** `chore(db): idempotent seed`

---

# PHASE 2: API foundation

### P2-C1: Express app skeleton
**Tasks**
- [ ] Split `app.ts` (builds app) from `main.ts` (listens). This makes tests easy.
- [ ] Middleware order: request-id, pino-http logger, helmet, CORS (allowlist from env), JSON body limit, cookie-parser.
- [ ] `/health/live` and `/health/ready` (checks DB and Redis).

**Packages:** `express`, `helmet`, `cors`, `cookie-parser`, `pino`, `pino-http`, `tsx` (dev), `@types/*`
**Test it:** Supertest hits `/health/live` and expects 200.
**Done when:** `pnpm --filter api dev` hot-reloads and the health endpoints work.
**Learn:** Middleware ordering, why `app` and `server` are separate.
**Commit:** `feat(api): express skeleton with health checks`

### P2-C2: Errors, validation, responses
**Tasks**
- [ ] `AppError` class with `statusCode`, `code`, `details`; central error middleware that never leaks stack traces in production.
- [ ] `validate({ body, query, params })` middleware using Zod.
- [ ] Consistent response envelope for errors: `{ error: { code, message, details } }`.
- [ ] Async handler wrapper (or Express 5 native promise support).

**Test it:** Invalid body returns 400 with field errors; unknown route returns 404 JSON.
**Done when:** Every thrown error becomes a structured JSON response.
**Learn:** Operational vs programmer errors, input validation as a security boundary.
**Commit:** `feat(api): error handling and validation middleware`

### P2-C3: Test harness
**Tasks**
- [ ] Vitest config for the API with separate `unit` and `integration` projects.
- [ ] Integration helper using **Testcontainers** (real Postgres with pgvector) that migrates once per run and truncates tables between tests.
- [ ] Factory helpers: `createUser()`, `createOrg()`, `createBot()`.

**Packages:** `vitest`, `supertest`, `@testcontainers/postgresql`, `@vitest/coverage-v8`
**Test it:** One integration test creates a user via factory and reads it back.
**Done when:** `pnpm test` runs unit and integration tests locally and passes.
**Learn:** Test isolation, why real DB tests beat mocking Prisma.
**Commit:** `test(api): vitest + testcontainers harness`

### P2-C4: Rate limiting and security basics
**Tasks**
- [ ] Global rate limiter (Redis store) plus a strict limiter for auth routes.
- [ ] Request body size limits; disable `x-powered-by`; trust-proxy setting for deployment.

**Packages:** `express-rate-limit`, `rate-limit-redis`, `ioredis`
**Test it:** 11th login attempt in a minute returns 429.
**Done when:** Limits are configurable through env.
**Commit:** `feat(api): redis-backed rate limiting`

---

# PHASE 3: Authentication

> Design target: email and password, email verification, password reset, short-lived access token, rotating refresh token in an httpOnly cookie, logout everywhere.

### P3-C1: Password hashing and registration
**Tasks**
- [ ] `POST /auth/register`: validate (email, password strength, name), hash with **Argon2id**, create user, create a personal organization and an `OWNER` membership in one transaction.
- [ ] Normalize emails (lowercase, trim). Return a generic response to avoid user enumeration where practical.

**Packages:** `argon2`
**Test it:** Duplicate email rejected; password stored hashed; transaction rolls back on failure.
**Done when:** Registration creates user, org, and membership atomically.
**Learn:** Why Argon2id over bcrypt, salting, transactions.
**Commit:** `feat(auth): registration with argon2 and org bootstrap`

### P3-C2: Email verification
**Tasks**
- [ ] Generate random token, store only its **SHA-256 hash** with expiry, email the link through Nodemailer (Mailpit locally; Resend or similar in production).
- [ ] `POST /auth/verify-email`; block login for unverified users (configurable).

**Packages:** `nodemailer` (or `resend`)
**Test it:** Open Mailpit at `localhost:8025`, click the link, user becomes verified; reused or expired token fails.
**Learn:** Single-use tokens, storing hashes of secrets.
**Commit:** `feat(auth): email verification flow`

### P3-C3: Login, access and refresh tokens
**Tasks**
- [ ] `POST /auth/login`: verify password, issue a 15-minute **access JWT** (returned in the body or a cookie) and a 7 to 30 day **opaque refresh token** in an httpOnly, Secure, SameSite cookie. Store only the refresh token hash plus device info and `familyId`.
- [ ] `POST /auth/refresh`: **rotate** the refresh token. If an already-used token appears, revoke the whole family (token theft detection).
- [ ] `POST /auth/logout` and `/auth/logout-all`.

**Packages:** `jose`
**Test it:** Refresh works once; replaying the old refresh token revokes the family; expired access token returns 401.
**Done when:** All paths covered by integration tests.
**Learn:** JWT pros and cons, refresh rotation, cookie flags, CSRF considerations (SameSite plus a custom header check).
**Commit:** `feat(auth): login with rotating refresh tokens`

### P3-C4: Password reset and account security
**Tasks**
- [ ] `POST /auth/forgot-password` (always 200) and `POST /auth/reset-password` (revokes all refresh tokens on success).
- [ ] `GET /auth/me`, `PATCH /auth/me`, `POST /auth/change-password`.
- [ ] Optional stretch: Google OAuth, TOTP 2FA.

**Test it:** Full flow in an integration test, plus Mailpit by hand.
**Commit:** `feat(auth): password reset and profile endpoints`

### P3-C5: `requireAuth` middleware
**Tasks**
- [ ] Verify JWT, load minimal user context (`userId`, `orgId` memberships), attach to `req.auth`, typed via declaration merging.

**Test it:** Protected route returns 401 without a token, 401 with a tampered token, 200 with a valid one.
**Commit:** `feat(auth): requireAuth middleware`

---

# PHASE 4: Multi-tenancy and authorization

### P4-C1: Organizations and membership model
**Tasks**
- [ ] Endpoints: create org, list my orgs, switch active org (via path `/orgs/:orgId/...`).
- [ ] `requireOrgMember` middleware: confirms the user belongs to `:orgId` and attaches `req.org` with the user's role.

**Test it:** User A cannot access org B's routes, even with a valid token.
**Learn:** Tenant resolution strategies, IDOR (insecure direct object reference).
**Commit:** `feat(tenancy): organizations and membership guard`

### P4-C2: Roles and permissions (RBAC)
**Tasks**
- [ ] In `packages/shared`, define roles (`OWNER`, `ADMIN`, `AGENT`, `VIEWER`) and a permission map, for example `bot:write`, `knowledge:write`, `billing:manage`, `member:invite`, `conversation:reply`.
- [ ] `requirePermission('bot:write')` middleware reading the role from `req.org`.
- [ ] Share the permission map with the frontend so the UI hides forbidden actions (the server still enforces them).

**Packages:** none required. Optionally evaluate `@casl/ability` and note why you chose or skipped it in an ADR.
**Test it:** Table-driven test: every role × permission combination returns the expected status.
**Done when:** No route is mounted without an auth and permission decision.
**Learn:** RBAC vs ABAC, deny by default, UI gating is not security.
**Commit:** `feat(authz): rbac permission map and middleware`

### P4-C3: Member invitations
**Tasks**
- [ ] Invite by email with a hashed expiring token, accept flow, change role, remove member. Prevent removing the last owner.

**Test it:** Invite, accept via Mailpit link, role change enforced.
**Commit:** `feat(tenancy): member invitations and role management`

### P4-C4: Tenant-safe data access
**Tasks**
- [ ] Create repository helpers that **require** `organizationId` as an argument (for example `botRepo.findById(orgId, id)`).
- [ ] Optional: a Prisma client extension that injects `organizationId` filters; or Postgres Row-Level Security as an advanced stretch.
- [ ] Write a dedicated **tenant isolation test suite**: for every tenant-owned endpoint, user from org A requests an id from org B and must receive 404.

**Done when:** The isolation suite runs in CI and fails if a new endpoint forgets scoping.
**Learn:** Defense in depth for multi-tenant data.
**Commit:** `test(tenancy): isolation suite and scoped repositories`

### P4-C5: Audit log
**Tasks**
- [ ] `auditLog.record({ orgId, actorId, action, target, metadata })` called on sensitive actions (invites, role changes, billing changes, bot deletion). List endpoint for owners.

**Commit:** `feat(audit): audit log service`

---

# PHASE 5: Frontend foundation (Next.js dashboard)

### P5-C1: Next.js, Tailwind, shadcn/ui
**Tasks**
- [ ] Create `apps/web` (App Router, TypeScript), Tailwind, shadcn/ui, `next-themes` (dark mode), `sonner` (toasts).
- [ ] Layouts: marketing, auth, dashboard (sidebar, topbar, org switcher placeholder).

**Packages:** `next`, `react`, `tailwindcss`, `shadcn` CLI components, `lucide-react`, `next-themes`, `sonner`
**Done when:** Dashboard shell renders responsively with dark mode.
**Commit:** `feat(web): app shell with shadcn and tailwind`

### P5-C2: API client and TanStack Query
**Tasks**
- [ ] A typed `apiFetch` wrapper: base URL, credentials, JSON parsing, error normalization, **automatic refresh on 401 once** (single-flight so parallel requests share one refresh).
- [ ] `QueryClientProvider`, query-key factory (`keys.bots.list(orgId)`), default stale times, global error toast.
- [ ] Reuse Zod schemas from `packages/shared` for response parsing where valuable.

**Packages:** `@tanstack/react-query`, `@tanstack/react-query-devtools`, `zod`
**Test it:** Unit test the 401 to refresh to retry logic with MSW.
**Learn:** Server state vs client state, cache invalidation, query keys.
**Commit:** `feat(web): api client and query setup`

### P5-C3: Auth pages and route protection
**Tasks**
- [ ] Register, login, verify-email, forgot/reset password pages using React Hook Form plus Zod resolver.
- [ ] Route protection using Next.js middleware (cookie presence check) plus a server-side session check in the dashboard layout.
- [ ] `useSession()` hook backed by `/auth/me`.

**Packages:** `react-hook-form`, `@hookform/resolvers`
**Test it:** Playwright: register, verify through Mailpit API, log in, reach the dashboard, log out; unauthenticated visit redirects to login.
**Commit:** `feat(web): auth pages and protected routes`

### P5-C4: Organization context and permission-aware UI
**Tasks**
- [ ] Org switcher, `useOrg()` context, `<Can permission="bot:write">` component using the shared permission map.
- [ ] Members page with **TanStack Table**: sorting, filtering, pagination, row actions (change role, remove).

**Packages:** `@tanstack/react-table`
**Done when:** A VIEWER sees no write buttons, and the API still rejects forged requests.
**Commit:** `feat(web): org context, members table, can-component`

---

# PHASE 6: Bots and settings

### P6-C1: Bot CRUD (API)
**Tasks**
- [ ] `Bot` fields: `name`, `publicKey` (random, non-guessable), `systemPrompt`, `welcomeMessage`, `theme` (JSON), `allowedDomains[]`, `model`, `isActive`, `handoffEnabled`.
- [ ] Endpoints under `/orgs/:orgId/bots` with `bot:read` and `bot:write` permissions. Enforce plan limits later (P14).
- [ ] Validate `allowedDomains` as bare hostnames (no paths, no wildcards at first).

**Test it:** CRUD plus isolation tests; invalid domains rejected.
**Learn:** Public identifiers vs secrets (the `publicKey` is public and safe to embed).
**Commit:** `feat(bots): bot crud api`

### P6-C2: Bot management UI
**Tasks**
- [ ] Bots list (TanStack Table), create/edit form (React Hook Form), appearance preview, "Install" tab showing the script snippet.
- [ ] Optimistic updates for the active toggle with rollback on error.

**Done when:** You can create a bot and see its embed snippet.
**Commit:** `feat(web): bots management ui`

---

# PHASE 7: Knowledge ingestion (RAG, part 1)

### P7-C1: Object storage and uploads
**Tasks**
- [ ] S3 client wrapper (MinIO locally, Cloudflare R2 or similar in production).
- [ ] `POST /bots/:id/documents` using **presigned upload URLs** (browser uploads directly) or `multer` streaming; then a "confirm" call that creates the `Document` row with status `PENDING`.
- [ ] Validate size limits, MIME type **and magic bytes**; randomize storage keys; store under `orgId/botId/`.

**Packages:** `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `file-type`
**Test it:** Upload a PDF through the API; a renamed `.exe` as `.pdf` is rejected.
**Learn:** Presigned URLs, never trusting file extensions.
**Commit:** `feat(knowledge): secure document upload`

### P7-C2: Worker app and queues
**Tasks**
- [ ] `apps/worker` with BullMQ queues: `ingestion`, `automation`, `digest`. Shared Redis connection settings. Graceful shutdown (SIGTERM).
- [ ] API enqueues `ingest-document` after upload confirmation; job options: attempts, exponential backoff, `removeOnComplete`.
- [ ] Optional: Bull Board (protected) for visibility.

**Packages:** `bullmq`, `ioredis`
**Test it:** Enqueue a dummy job and see it processed; kill the worker mid-job and see the retry.
**Learn:** At-least-once delivery, idempotent jobs.
**Commit:** `feat(worker): bullmq worker app`

### P7-C3: Text extraction
**Tasks**
- [ ] Processors for PDF, DOCX, TXT/MD, and **URL crawl** (fetch, strip boilerplate, extract main content).
- [ ] **SSRF protection** for crawling: allow only http/https, resolve DNS and block private, loopback and link-local ranges, limit redirects, size, and time.
- [ ] Update `Document.status`: `PENDING` to `PROCESSING` to `READY` or `FAILED` (with an error message).

**Packages:** `unpdf` (or `pdf-parse`), `mammoth`, `cheerio`, `@mozilla/readability` with `jsdom`
**Test it:** Fixture files for each type; crawler refuses `http://169.254.169.254` and `http://localhost`.
**Learn:** SSRF, a classic cloud vulnerability and a great interview topic.
**Commit:** `feat(knowledge): extraction for pdf, docx, text and urls`

### P7-C4: Chunking and embeddings
**Tasks**
- [ ] Chunker: about 500 to 800 tokens per chunk with 10 to 15 percent overlap, preferring paragraph and heading boundaries; store `position`, `sourceTitle`, `pageNumber` or `url`.
- [ ] Embedding client behind an interface (`EmbeddingProvider`) so you can swap providers. Anthropic does not provide embeddings, so use OpenAI, Voyage AI, a free tier, or a local model through Ollama or transformers.js for zero cost.
- [ ] Batch embedding calls, handle rate limits with retries, store vectors in `Chunk.embedding` via raw SQL (`$executeRaw`).
- [ ] Re-ingestion deletes old chunks first (idempotent).

**Packages:** `openai` (or provider SDK), `gpt-tokenizer` (or `js-tiktoken`)
**Test it:** Unit tests for chunk sizes and overlap; integration test inserts and queries vectors.
**Learn:** Chunking trade-offs, embedding dimensions, batching.
**Commit:** `feat(knowledge): chunking and embedding pipeline`

### P7-C5: Knowledge UI
**Tasks**
- [ ] Documents table with status badges (polling or SSE for progress), upload dropzone, add-URL form, delete and re-index actions.
- [ ] Show chunk count and last indexed time.

**Test it:** Playwright: upload a sample PDF and wait for `READY`.
**Commit:** `feat(web): knowledge management ui`

---

# PHASE 8: RAG chat engine (RAG, part 2)

### P8-C1: Retrieval
**Tasks**
- [ ] `retrieve(orgId, botId, query, k)` doing **hybrid search**: vector similarity (cosine, HNSW) plus Postgres full-text rank, combined with Reciprocal Rank Fusion.
- [ ] Always filter by `organizationId` and `botId` **inside the SQL**.
- [ ] Optional: query rewriting using the last few turns; a reranker for a quality bump.

**Test it:** Seeded documents with known answers; assert the right chunk appears in the top 3.
**Learn:** Dense vs sparse retrieval, why hybrid beats either alone, RRF.
**Commit:** `feat(ai): hybrid retrieval`

### P8-C2: Prompting, citations, fallback
**Tasks**
- [ ] Prompt template with: role and tone (from `bot.systemPrompt`), strict "answer only from the context" rule, numbered sources, citation format, and a graceful "I don't know, would you like to talk to a human?" fallback when retrieval confidence is low.
- [ ] Wrap retrieved text in delimiters and tell the model it is **untrusted data, not instructions** (first prompt-injection defense).
- [ ] Return structured citations (`documentId`, `title`, `snippet`).

**Packages:** `@anthropic-ai/sdk` or `openai`
**Test it:** Question outside the knowledge base triggers the fallback; in-scope question returns citations.
**Learn:** Grounding, hallucination control, prompt injection basics.
**Commit:** `feat(ai): grounded answers with citations`

### P8-C3: Streaming chat endpoint and persistence
**Tasks**
- [ ] `POST /orgs/:orgId/bots/:botId/chat` (dashboard playground) streaming via **SSE**: events `token`, `citations`, `done`, `error`.
- [ ] Persist `Conversation` and `Message` rows (role, content, citations, tokens in/out, latency, model).
- [ ] Handle client aborts (cancel the upstream LLM call), timeouts, and provider errors with a safe user-facing message.

**Test it:** Integration test reads the SSE stream and assembles the final message; abort test confirms the upstream is cancelled.
**Learn:** SSE vs WebSockets, backpressure, cancellation.
**Commit:** `feat(chat): streaming chat with persistence`

### P8-C4: Playground UI
**Tasks**
- [ ] Dashboard chat playground with streaming text, citation chips, "thumbs up/down" feedback saved to the message, and a debug panel showing retrieved chunks (great for demos).

**Commit:** `feat(web): bot playground with debug panel`

---

# PHASE 9: Embeddable widget (public surface)

### P9-C1: Public chat API
**Tasks**
- [ ] `POST /public/v1/session`: input `botKey`; checks the bot is active and the request `Origin` matches `allowedDomains`; returns a short-lived **visitor session token** (JWT bound to `botId`, conversationId and origin).
- [ ] `POST /public/v1/chat` (SSE): requires the session token; separate CORS policy (reflect only allowed origins for that bot); strict per-IP and per-session rate limits; per-bot monthly usage check.
- [ ] Never accept `orgId` or `botId` from the client body without verifying it against the token.

**Test it:** Wrong origin gets 403; tampered token gets 401; rate limit returns 429; quota exhausted returns a friendly fallback.
**Learn:** Public endpoints threat model: abuse, cost attacks, origin spoofing (note: `Origin` is not authentication, so combine with rate limits and quotas).
**Commit:** `feat(public): session and chat endpoints for widget`

### P9-C2: Widget app
**Tasks**
- [ ] Preact + Vite library build producing a single `widget.js` (IIFE).
- [ ] Reads `data-bot-id` from its script tag, mounts inside a **Shadow DOM** (CSS isolation), launcher bubble plus chat window, streaming render, markdown subset, citation links, mobile responsive, keyboard accessible.
- [ ] Persist conversation id in `localStorage` (try/catch); "Talk to a human" button; basic theming from bot config.
- [ ] Keep the bundle small (target under about 50 KB gzipped) and add a size check to CI.

**Packages:** `preact`, `vite`, `@preact/preset-vite`
**Test it:** A plain `test.html` page embeds the script; test on a WordPress site (your strength) via a tiny plugin that injects the snippet.
**Done when:** Embedding on two different test sites works, and a non-allowed domain is blocked.
**Commit:** `feat(widget): preact widget with shadow dom`

### P9-C3: Hosted help page
**Tasks**
- [ ] `/help/[botKey]` in Next.js: full-page version of the chat for businesses without a website to embed in.

**Commit:** `feat(web): hosted help page`

---

# PHASE 10: AI agent (tool calling)

### P10-C1: Tool framework
**Tasks**
- [ ] `ToolDefinition` interface: `name`, `description`, `inputSchema` (Zod, converted to JSON Schema), `requiresConfirmation`, `execute(ctx, input)`.
- [ ] Tool registry per bot (owner enables or disables tools).
- [ ] Agent loop: model call, tool call, execute, return result, model call, until final answer or **max steps** (for example 5). Log each step into `ToolCall` (input, output, duration, status).
- [ ] The execution context (`orgId`, `botId`, `conversationId`) comes from the server, **never from model output**.

**Test it:** Mock LLM that returns scripted tool calls; assert loop limits, logging, and error handling (tool throws leads to a graceful model-visible error).
**Learn:** What an "agent" really is, bounded loops, trust boundaries.
**Commit:** `feat(agent): tool framework and bounded loop`

### P10-C2: Built-in tools
**Tasks**
- [ ] `create_ticket(subject, summary, priority)`
- [ ] `capture_lead(name, email, message)` (validated email, consent wording)
- [ ] `handoff_to_human(reason)`: flips the conversation to `NEEDS_HUMAN` and notifies the team.
- [ ] `lookup_order(orderId)`: calls a **tenant-configured webhook** (HMAC-signed request, timeout, SSRF checks, response schema validation).
- [ ] Confirmation step for side-effect tools: the model proposes, the widget shows "Create ticket? Yes/No", and only then does it execute.

**Test it:** Each tool has unit tests plus one end-to-end conversation test per tool.
**Learn:** Human-in-the-loop for side effects, signed webhooks.
**Commit:** `feat(agent): ticket, lead, handoff and order-lookup tools`

### P10-C3: Tool settings UI
**Tasks**
- [ ] Per-bot tools page: enable toggles, webhook URL and secret (write-only field), test button, recent tool calls table.

**Commit:** `feat(web): agent tool settings and logs`

---

# PHASE 11: Tickets and human inbox

### P11-C1: Tickets API and UI
**Tasks**
- [ ] Ticket statuses (`OPEN`, `PENDING`, `RESOLVED`), priority, assignee, linked conversation, internal notes.
- [ ] Tickets table: server-side pagination, filters (status, assignee, date), sorting, bulk actions using TanStack Table.

**Commit:** `feat(tickets): ticket management api and ui`

### P11-C2: Live inbox and takeover
**Tasks**
- [ ] Inbox lists conversations with `NEEDS_HUMAN` first; an agent can "take over" so the bot stops replying; agent replies stream to the visitor's widget (SSE channel with Redis pub/sub for multi-instance safety).
- [ ] Release back to the bot; typing indicators optional.

**Test it:** Playwright with two browser contexts (visitor and agent) exchanging messages.
**Learn:** Pub/sub fan-out, concurrency (two agents claiming one chat: use an atomic update).
**Commit:** `feat(inbox): live human takeover`

---

# PHASE 12: Workflow automation

### P12-C1: Post-conversation pipeline
**Tasks**
- [ ] When a conversation goes idle (delayed job) or is closed: generate summary, sentiment, topic tags, and resolution status using structured JSON output validated by Zod.
- [ ] Save results on the conversation; show them in the inbox and analytics.

**Test it:** Mocked LLM returns invalid JSON once; the job retries or repairs; final state is valid.
**Learn:** Structured output, validation and retries of LLM responses.
**Commit:** `feat(automation): conversation summarization pipeline`

### P12-C2: Knowledge-gap detection
**Tasks**
- [ ] Flag messages where retrieval confidence was low or the user gave a thumbs down; cluster similar questions (simple embedding similarity grouping); show a **Knowledge Gaps** page with a "Add answer to knowledge base" action that creates a small document.

**Commit:** `feat(automation): knowledge gap detection`

### P12-C3: Notifications and scheduled digests
**Tasks**
- [ ] Slack incoming-webhook and email notifications for handoffs and high-priority tickets (per-org settings).
- [ ] Weekly digest using BullMQ repeatable jobs: top questions, unanswered count, CSAT, usage.
- [ ] Dead-letter handling: failed jobs after all retries land in a "failed" list you can inspect.

**Commit:** `feat(automation): notifications and weekly digest`

---

# PHASE 13: AI business assistant (owner-facing)

### P13-C1: Analytics foundation
**Tasks**
- [ ] Analytics endpoints: conversations per day, resolution rate, handoff rate, average first-response time, top topics, token usage and estimated cost, thumbs up/down ratio.
- [ ] Dashboard with Recharts: line, bar, and stat cards; date-range picker; cache with sensible `staleTime`.

**Packages:** `recharts`, `date-fns`
**Test it:** Seed known data; assert exact aggregate numbers.
**Commit:** `feat(analytics): metrics api and dashboard`

### P13-C2: Business assistant chat
**Tasks**
- [ ] A separate assistant for owners: "What frustrated customers most this week?", "Which topics should I add to my FAQ?", "Summarize yesterday's handoffs".
- [ ] Implement with **predefined, parameterized tools** (`get_metrics`, `search_conversations`, `list_knowledge_gaps`, `summarize_conversations`). **Do not** let the model write raw SQL.
- [ ] Permission-gated (`analytics:read`), tenant-scoped, rate-limited, and cost-logged.

**Learn:** Why tool-based analytics is safer than text-to-SQL, and a trust boundary you can explain.
**Commit:** `feat(assistant): owner business assistant with analytics tools`

---

# PHASE 14: Billing, subscriptions, usage limits

### P14-C1: Plans and Stripe setup
**Tasks**
- [ ] Define plans in one config (`packages/shared/plans.ts`): Free, Pro, Business with limits: messages per month, documents, bots, team members, features (agent tools, business assistant).
- [ ] Create Stripe test products and prices; store price IDs in env. Add `stripeCustomerId` on `Organization`.

**Packages:** `stripe`
**Commit:** `feat(billing): plan definitions and stripe config`

### P14-C2: Checkout and customer portal
**Tasks**
- [ ] `POST /billing/checkout` creates a Checkout Session (subscription mode, `client_reference_id` or metadata with `orgId`); `POST /billing/portal` creates a Billing Portal session. Permission: `billing:manage`.
- [ ] Pricing page and billing page in the dashboard (current plan, usage bars, upgrade button).

**Test it:** Use Stripe test cards (`4242 4242 4242 4242`) in the browser.
**Commit:** `feat(billing): checkout and customer portal`

### P14-C3: Webhooks (the important part)
**Tasks**
- [ ] `POST /webhooks/stripe` using the **raw body** and **signature verification**.
- [ ] Handle: `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.payment_failed`, `invoice.paid`.
- [ ] **Idempotency:** store each Stripe `event.id` in `WebhookEvent`; skip duplicates. Process out-of-order events safely (compare timestamps or re-fetch the subscription).
- [ ] The subscription row is the source of truth for plan checks; the app never trusts the browser redirect for fulfillment.
- [ ] Local development with the Stripe CLI (`stripe listen --forward-to ...`).

**Test it:** Integration tests posting signed fixture payloads; duplicate event ignored; bad signature returns 400.
**Learn:** Webhook security, idempotency, eventual consistency.
**Commit:** `feat(billing): verified idempotent stripe webhooks`

### P14-C4: Entitlements and usage metering
**Tasks**
- [ ] `entitlements.check(orgId, 'messages')` used by chat endpoints, upload endpoints, bot creation, and member invites.
- [ ] `UsageRecord` increments atomically (Redis counter flushed to Postgres, or a single `UPDATE ... SET count = count + 1`).
- [ ] Soft warning at 80 percent, hard block at 100 percent with a friendly widget message; monthly reset.
- [ ] Downgrade behavior defined (for example, existing documents stay but uploads are blocked).

**Test it:** Table-driven tests per plan; concurrency test sending many parallel messages near the limit.
**Commit:** `feat(billing): entitlements and usage metering`

---

# PHASE 15: Security hardening

### P15-C1: AI-specific security
**Tasks**
- [ ] **Prompt injection tests:** documents or user messages containing "ignore previous instructions" must not change tool permissions or leak the system prompt.
- [ ] Output handling: render markdown safely (sanitize HTML) in widget and dashboard.
- [ ] Limit tool arguments, enforce schemas, cap message length, cap conversation history size, and cap max output tokens.
- [ ] PII-aware logging: never log raw message bodies at info level in production; add a redaction helper for emails and phone numbers.
- [ ] Per-tenant and global **spend caps** with alerts.

**Test it:** A red-team test file with 15 to 20 adversarial prompts and expected safe behavior.
**Learn:** OWASP Top 10 for LLM applications (read it and reference it in your README).
**Commit:** `feat(security): prompt injection defenses and redaction`

### P15-C2: Web and API security checklist
**Tasks**
- [ ] Security headers and CSP for the web app; secure cookies; CORS allowlists; HTTPS-only in production.
- [ ] Dependency scanning (`pnpm audit`, Dependabot), secret scanning, and Trivy scan on Docker images in CI.
- [ ] Data lifecycle: delete organization (cascade including vectors and S3 objects), export data, retention setting for conversations.
- [ ] Review against OWASP ASVS basics; note findings in `docs/security.md`.

**Commit:** `chore(security): headers, scanning and data deletion`

---

# PHASE 16: Complete test system

### Test pyramid for this project

| Layer | Tool | What it covers | Target |
|---|---|---|---|
| Unit | Vitest | Chunker, permissions, entitlements, prompt builders | Fast, many |
| Integration | Vitest + Supertest + Testcontainers | Routes, auth flows, tenancy isolation, webhooks, queues | Core confidence |
| Component | Testing Library + Vitest (jsdom) | Forms, tables, `<Can>` | Selective |
| E2E | Playwright | Register to subscribe to upload to embed to chat | 5 to 8 golden paths |
| AI evals | Custom runner in `evals/` | RAG quality and safety | Run on demand and nightly |
| Load (stretch) | k6 | Public chat endpoint | One script |

### P16-C1: Coverage and quality gates
**Tasks**
- [ ] Coverage thresholds (for example 80 percent on `modules/auth`, `billing`, `agent`), reported in CI.
- [ ] Contract test: the API response shapes validated with the shared Zod schemas on both sides.

**Commit:** `test: coverage gates and contract checks`

### P16-C2: Playwright golden paths
**Tasks**
- [ ] Specs: (1) register, verify, login; (2) create bot, upload doc, wait ready; (3) playground answer with citation; (4) widget embed on a static page, ask a question; (5) handoff and agent takeover; (6) upgrade via Stripe test checkout (can be mocked in CI, real in a manual run); (7) viewer role cannot see write actions.
- [ ] Use a **fake LLM provider** (deterministic responses) in CI so tests are free and stable.

**Commit:** `test(e2e): playwright golden paths`

### P16-C3: RAG evaluation harness
**Tasks**
- [ ] `evals/dataset.json`: 30 or more questions with expected facts and the source document.
- [ ] Metrics: **retrieval hit@k**, **answer contains expected facts** (string checks plus optional LLM-as-judge), **refusal accuracy** for out-of-scope questions, latency and cost.
- [ ] Script `pnpm eval` prints a table and saves JSON results; track the score across commits in `docs/eval-history.md`.

**Learn:** How AI engineers measure quality instead of guessing. This is one of the strongest items in your portfolio.
**Commit:** `feat(evals): rag evaluation harness`

---

# PHASE 17: Observability

### P17-C1: Logging, errors, metrics
**Tasks**
- [ ] Structured JSON logs with request-id, orgId, userId; propagate the request-id into worker jobs.
- [ ] Sentry in API, worker, and web (source maps for web).
- [ ] `/metrics` (Prometheus format) or simple counters: requests, errors, queue depth, LLM latency, tokens.
- [ ] Optional LLM tracing with a self-hosted or free-tier tool such as Langfuse.
- [ ] Uptime check on `/health/ready` with a free monitor.

**Packages:** `@sentry/node`, `@sentry/nextjs`, `prom-client` (optional)
**Commit:** `feat(observability): logging, sentry and metrics`

### P17-C2: Cost and usage visibility
**Tasks**
- [ ] Store tokens and estimated cost per message; admin view of cost per tenant and per day; alert when daily spend crosses a threshold.

**Commit:** `feat(observability): llm cost tracking`

---

# PHASE 18: Production Docker

### P18-C1: Production images
**Tasks**
- [ ] Multi-stage Dockerfiles for `api`, `worker`, and `web` using `turbo prune` (or pnpm deploy) so each image contains only what it needs.
- [ ] Run as non-root, `NODE_ENV=production`, `HEALTHCHECK`, small base image (for example `node:22-alpine` or distroless), `.dockerignore`.
- [ ] Prisma: generate in build stage, run `prisma migrate deploy` as a **separate release step**, not on every container boot.

```dockerfile
# apps/api/Dockerfile (outline)
FROM node:22-alpine AS base
RUN corepack enable
FROM base AS pruner
WORKDIR /app
COPY . .
RUN pnpm dlx turbo prune api --docker
FROM base AS builder
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN pnpm --filter api build
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /app .
USER app
EXPOSE 4000
HEALTHCHECK CMD wget -qO- http://localhost:4000/health/live || exit 1
CMD ["node", "apps/api/dist/main.js"]
```

**Test it:** `docker compose -f docker-compose.prod.yml up` runs the whole stack from images; image sizes recorded in the README.
**Learn:** Layer caching, image size, least privilege.
**Commit:** `build: production dockerfiles`

---

# PHASE 19: CI/CD with GitHub Actions

### P19-C1: Continuous integration
**Tasks**
- [ ] `ci.yml` on pull requests and pushes: checkout, pnpm cache, install, `lint`, `typecheck`, unit and integration tests (Testcontainers works on GitHub runners or use `services:` for Postgres/Redis), build all apps, Playwright against a built stack, upload reports.
- [ ] Concurrency group that cancels outdated runs; required status checks on `main`.

```yaml
name: ci
on: [pull_request, push]
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run lint typecheck test build
```

**Done when:** A failing test blocks merging.
**Commit:** `ci: github actions verify pipeline`

### P19-C2: Continuous delivery
**Tasks**
- [ ] `deploy.yml` on merge to `main` (or on version tags): build and push images to **GHCR** tagged with the commit SHA, scan with Trivy, run `prisma migrate deploy` against production, trigger the host's deploy hook, then run a **smoke test** (`/health/ready` plus one scripted request).
- [ ] Use GitHub **Environments** with protected secrets; never commit secrets; rotate on leak.
- [ ] Rollback plan documented (redeploy previous SHA; migrations written backward-compatible).
- [ ] Dependabot or Renovate for updates.

**Learn:** Immutable image tags, expand and contract migrations, release vs deploy.
**Commit:** `ci: image build, scan and deploy pipeline`

---

# PHASE 20: Free-tier deployment

> Free tiers change often. Verify current limits and terms before relying on any of these.

| Piece | Typical free option | Notes |
|---|---|---|
| Web (Next.js) | Vercel or Cloudflare Pages | Easiest for the dashboard |
| API (Docker) | Render, Koyeb, or a similar free container host | Free instances often sleep, so document cold starts |
| Worker (Docker) | Same host as a background worker, or run it inside the API process in demo mode | Some hosts do not offer free background workers |
| PostgreSQL + pgvector | Neon or Supabase | Confirm pgvector is enabled |
| Redis | Upstash | Watch command limits (BullMQ is chatty, so tune polling/settings) |
| Object storage | Cloudflare R2 | S3-compatible |
| Email | Resend free tier | Verify a sending domain |
| Errors | Sentry free | |
| Widget CDN | Serve `widget.js` from the web app or Cloudflare | Cache with versioned URLs |

### P20-C1: First deployment
**Tasks**
- [ ] Provision services, set environment variables, run migrations, deploy API, worker, and web, set CORS and cookie domains, switch Stripe webhooks to the public URL.
- [ ] Add a custom domain (for example `sparkpilot.devsparkr.com`) if you own `devsparkr`.
- [ ] Deploy a **demo tenant** with a sample company knowledge base and a public demo page; add demo login with fake data.

**Test it:** Run your Playwright smoke suite against production; embed the widget on a separate site (for example a free static page) and chat.
**Done when:** A stranger can open the link, try the demo bot, and sign up.
**Commit:** `chore(deploy): first production release`

### P20-C2: Reliability touches
**Tasks**
- [ ] Keep-warm ping or a clear cold-start UI message, graceful degradation if Redis or the LLM is down, backups (Neon branching or scheduled `pg_dump`), and a short runbook in `docs/runbook.md`.

**Commit:** `docs: runbook and reliability tweaks`

---

# PHASE 21: Portfolio packaging

### P21-C1: README and docs
**Tasks**
- [ ] README sections: one-line pitch, live demo link, demo credentials, screenshots or GIF, architecture diagram (Mermaid), feature list, tech stack, **how to run locally in 3 commands**, test commands, CI badge, deployment overview, security notes, known limitations, roadmap.
- [ ] `docs/adr/` with 6 to 8 short decisions (monorepo, pgvector, own auth, SSE, BullMQ, RBAC, hybrid search).
- [ ] `docs/architecture.md` explaining the request flow of a chat message from widget to answer.

### P21-C2: Demo and career assets
**Tasks**
- [ ] 2 to 3 minute demo video: sign up, subscribe, upload, embed on a WordPress site, chat, handoff, analytics.
- [ ] Case study page on your DevSparkr site: problem, architecture, hard problems solved (tenant isolation, webhook idempotency, SSRF, eval harness), results.
- [ ] Resume bullets (examples below), LinkedIn featured link, GitHub pinned repo with a good description and topics.

**Resume bullet examples (edit to match what you really built)**
- Built **SparkPilot**, a multi-tenant AI support SaaS (Next.js, Express, PostgreSQL/pgvector, BullMQ) with an embeddable RAG chatbot, tool-calling agent, and human handoff.
- Implemented JWT auth with rotating refresh tokens, RBAC, and automated tenant-isolation tests.
- Integrated Stripe subscriptions with idempotent signed webhooks and per-plan usage metering.
- Created a RAG evaluation harness tracking retrieval hit-rate and answer accuracy across releases.
- Shipped Dockerized services with GitHub Actions CI/CD, image scanning, and automated migrations.

### Interview questions this project prepares you for
1. How do you keep one tenant's data from leaking into another's?
2. Explain refresh token rotation and what happens if a token is stolen.
3. How do you make Stripe webhooks safe and idempotent?
4. How does your RAG pipeline work, and how do you know it is good?
5. What is prompt injection and how did you mitigate it?
6. Why SSE instead of WebSockets? Why a queue? Why pgvector?
7. What would you change to scale this to 10,000 tenants?

---

# Appendix A: Package cheat sheet

| Area | Packages |
|---|---|
| Tooling | `pnpm`, `turbo`, `typescript`, `tsx`, `tsup` or `esbuild`, `eslint`, `typescript-eslint`, `prettier`, `husky`, `lint-staged`, `@commitlint/*` |
| API | `express`, `helmet`, `cors`, `cookie-parser`, `pino`, `pino-http`, `zod`, `express-rate-limit`, `rate-limit-redis`, `ioredis` |
| Auth | `argon2`, `jose`, `nodemailer` or `resend` |
| Data | `prisma`, `@prisma/client` (+ raw SQL for pgvector) |
| Queue | `bullmq` |
| Storage/files | `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `multer` (if streaming), `file-type` |
| Parsing | `unpdf` or `pdf-parse`, `mammoth`, `cheerio`, `@mozilla/readability`, `jsdom` |
| AI | `@anthropic-ai/sdk` and/or `openai`, an embeddings provider, `gpt-tokenizer` |
| Billing | `stripe` |
| Web | `next`, `react`, `tailwindcss`, shadcn/ui, `@tanstack/react-query`, `@tanstack/react-table`, `react-hook-form`, `@hookform/resolvers`, `recharts`, `sonner`, `next-themes`, `lucide-react`, `date-fns` |
| Widget | `preact`, `vite`, `@preact/preset-vite` |
| Testing | `vitest`, `supertest`, `@testcontainers/postgresql`, `msw`, `@testing-library/react`, `@playwright/test`, `@vitest/coverage-v8` |
| Observability | `@sentry/node`, `@sentry/nextjs`, `prom-client` (optional) |

# Appendix B: `.env.example` (starter)

```bash
NODE_ENV=development
APP_URL=http://localhost:3000
API_URL=http://localhost:4000
CORS_ORIGINS=http://localhost:3000

DATABASE_URL=postgresql://sparkpilot:sparkpilot@localhost:5432/sparkpilot
REDIS_URL=redis://localhost:6379

JWT_ACCESS_SECRET=change-me-32-chars-min
JWT_ACCESS_TTL=15m
REFRESH_TTL_DAYS=30
VISITOR_JWT_SECRET=change-me-too

SMTP_HOST=localhost
SMTP_PORT=1025
EMAIL_FROM="SparkPilot <no-reply@sparkpilot.local>"

S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=sparkpilot
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin

LLM_PROVIDER=anthropic          # or openai, or fake (tests)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
EMBEDDING_PROVIDER=openai       # or local
EMBEDDING_DIM=1536
MONTHLY_SPEND_CAP_USD=10

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PRO=
STRIPE_PRICE_BUSINESS=

SENTRY_DSN=
```

# Appendix C: Prisma schema draft (core models)

```prisma
enum Role { OWNER ADMIN AGENT VIEWER }
enum DocStatus { PENDING PROCESSING READY FAILED }
enum ConvStatus { BOT_ACTIVE NEEDS_HUMAN HUMAN_ACTIVE CLOSED }

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String
  passwordHash  String
  emailVerified DateTime?
  createdAt     DateTime @default(now())
  memberships   Membership[]
  refreshTokens RefreshToken[]
}

model Organization {
  id               String   @id @default(cuid())
  name             String
  slug             String   @unique
  stripeCustomerId String?  @unique
  createdAt        DateTime @default(now())
  memberships      Membership[]
  bots             Bot[]
  subscription     Subscription?
}

model Membership {
  id             String @id @default(cuid())
  userId         String
  organizationId String
  role           Role
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  @@unique([userId, organizationId])
  @@index([organizationId])
}

model RefreshToken {
  id        String   @id @default(cuid())
  userId    String
  familyId  String
  tokenHash String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  revokedAt DateTime?
  userAgent String?
  user      User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, familyId])
}

model Bot {
  id             String   @id @default(cuid())
  organizationId String
  name           String
  publicKey      String   @unique
  systemPrompt   String   @default("")
  welcomeMessage String   @default("Hi! How can I help?")
  theme          Json     @default("{}")
  allowedDomains String[]
  isActive       Boolean  @default(true)
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  documents      Document[]
  conversations  Conversation[]
  @@index([organizationId])
}

model Document {
  id             String    @id @default(cuid())
  organizationId String
  botId          String
  title          String
  sourceType     String    // FILE | URL | TEXT
  storageKey     String?
  sourceUrl      String?
  status         DocStatus @default(PENDING)
  error          String?
  bot            Bot @relation(fields: [botId], references: [id], onDelete: Cascade)
  chunks         Chunk[]
  @@index([organizationId, botId])
}

model Chunk {
  id             String @id @default(cuid())
  organizationId String
  botId          String
  documentId     String
  position       Int
  content        String
  embedding      Unsupported("vector(1536)")?
  document       Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  @@index([organizationId, botId])
}

model Conversation {
  id             String     @id @default(cuid())
  organizationId String
  botId          String
  status         ConvStatus @default(BOT_ACTIVE)
  visitorId      String
  summary        String?
  sentiment      String?
  tags           String[]
  createdAt      DateTime   @default(now())
  bot            Bot @relation(fields: [botId], references: [id], onDelete: Cascade)
  messages       Message[]
  @@index([organizationId, botId, createdAt])
}

model Message {
  id             String   @id @default(cuid())
  conversationId String
  organizationId String
  role           String   // user | assistant | agent | tool
  content        String
  citations      Json?
  tokensIn       Int?
  tokensOut      Int?
  latencyMs      Int?
  feedback       Int?     // -1 | 0 | 1
  createdAt      DateTime @default(now())
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  @@index([conversationId, createdAt])
}

model Subscription {
  id                   String   @id @default(cuid())
  organizationId       String   @unique
  stripeSubscriptionId String   @unique
  plan                 String
  status               String
  currentPeriodEnd     DateTime
  organization         Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}

model WebhookEvent {
  id          String   @id            // Stripe event id (idempotency key)
  type        String
  processedAt DateTime @default(now())
}
```

> Add `ToolCall`, `Ticket`, `Lead`, `UsageRecord`, `AuditLog`, and `EmailToken` following the same pattern (every tenant-owned table carries `organizationId` plus an index that starts with it). Add the HNSW and full-text indexes in a hand-written SQL migration.

# Appendix D: Suggested schedule (part-time, about 2 to 3 hours per day)

| Week | Phases | Milestone |
|---|---|---|
| 1 | 0, 1, 2 | Monorepo, DB, API skeleton, test harness green |
| 2 | 3, 4 | Full auth and RBAC with isolation tests |
| 3 | 5, 6 | Dashboard with login, members, bots |
| 4 | 7 | Documents ingested and embedded |
| 5 | 8, 9 | Streaming RAG chat and working widget |
| 6 | 10, 11 | Agent tools, tickets, human takeover |
| 7 | 12, 13 | Automation pipeline and business assistant |
| 8 | 14 | Stripe subscriptions, limits |
| 9 | 15, 16, 17 | Security, tests, evals, observability |
| 10 | 18, 19, 20, 21 | Docker, CI/CD, free deployment, portfolio assets |

**Scope-control tip:** If time is short, ship in this order: Phases 0 to 9, 14, 18 to 20 (a working billed RAG product), then add 10 to 13 and 15 to 17 as upgrades. A smaller deployed product beats a bigger unfinished one.

# Appendix E: Definition of Done (whole project)

- [ ] A stranger can sign up, pay with a test card, upload a document, embed the widget, and get cited answers
- [ ] Tenant isolation suite, auth flow tests, webhook tests, and e2e golden paths all pass in CI
- [ ] RAG eval score is recorded and improving across commits
- [ ] Images build in CI, are scanned, and deploy automatically with migrations
- [ ] README, architecture diagram, ADRs, demo video, and case study are published
- [ ] You can explain every design decision above without notes

---
*SparkPilot by DevSparkr. Build it chunk by chunk, test everything, and write down what you learn.*