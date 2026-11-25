# TASKS.md: SparkPilot by DevSparkr

Companion files: `AGENTS.md` (rules for the agent) · `contract.prisma` (copy to `packages/db/prisma/`).

**How to use with GitHub Copilot agent:** one chunk = one GitHub issue = one small PR. Title the issue with the chunk ID, paste its block as the body, assign it to Copilot, review, merge when CI is green. Prompt: *"Implement chunk P4-03 from TASKS.md. Follow AGENTS.md. Add the tests listed."*
Each chunk is small enough to review in one sitting. Do not start the next chunk until **Done** is true.

---

## Decisions

| Topic | Choice | Why |
|---|---|---|
| Versions | Latest stable of everything (Next.js, Express 5, React, Zod, Tailwind, TanStack…); **Prisma ORM 8** | Your requirement. Agent must read current docs, not rely on memory |
| Queue | **pg-boss** on Postgres | No Redis to host; fits free tiers |
| Files | Extract text in memory, keep `Document.extractedText`; no object storage | Less infrastructure |
| Realtime | SSE + in-process emitter (single instance) | Enough for a demo |
| Auth | Own: Argon2id + JWT access token + rotating refresh cookie | Learn the internals |
| Vectors | pgvector `vector(768)`, HNSW cosine + full-text, merged with RRF | One database |
| Payments | Stripe test mode + Stripe CLI | Free |

**Free hosting (check current limits before relying on them):** Web → Vercel Hobby · API (Docker) → Render free web service (sleeps when idle; worker runs inline via `WORKER_MODE=inline`) · DB → Neon free (use the **direct** connection for migrations and pg-boss) · CI/CD → GitHub Actions + GHCR · Errors → Sentry free · Email → Mailpit (dev), Resend/Brevo free or `EMAIL_MODE=console` (demo).

### Authorization model
- **Platform:** `User.platformRole = PLATFORM_ADMIN` → `requirePlatformAdmin` on `/admin/*`; every action audit-logged.
- **Organization:** `Membership.role` (OWNER, ADMIN, AGENT, VIEWER) → permission map in `packages/shared` (`bot:write`, `knowledge:write`, `conversation:reply`, `billing:manage`, `member:invite`, `analytics:read`…). Handlers check **permissions**, never role names.
- **Resource:** extra rules in services (an AGENT replies only to unassigned or own conversations; the last OWNER cannot leave).
- **Visitor:** separate token bound to `botId + conversationId + origin`; never accepted on dashboard routes.
- Pipeline: `authenticate` (who) → `loadOrg` (which tenant, which role) → `requirePermission` (what). Keeping these three separate makes every route easy to audit and test.

### Free AI models
| Task | Suggested model | Env |
|---|---|---|
| Agent loop, business assistant, summaries | **`nvidia/nemotron-3-ultra-550b-a55b`**: NVIDIA API Catalog (OpenAI-compatible `https://integrate.api.nvidia.com/v1`, key from build.nvidia.com) or OpenRouter `…:free` | `LLM_AGENT_MODEL` |
| Fast visitor chat | Lighter model: Gemini Flash-Lite (free tier), a Groq Llama-class model, or Nemotron 3 Super | `LLM_CHAT_MODEL` |
| Background batch (tags, sentiment) | Same as chat model | `LLM_BATCH_MODEL` |
| Embeddings (768 dims) | `gemini-embedding-001` with 768 output dims, or Ollama `nomic-embed-text` | `EMBEDDING_PROVIDER` |
| Offline dev | Ollama | `LLM_PROVIDER=ollama` |
| Tests / CI | `fake` provider | `LLM_PROVIDER=fake` |

Notes: Nemotron 3 Ultra is a very large reasoning model with a 1M-token context, built for agents and tool calling, and free-tier endpoints are rate limited with variable latency, so use it for agent and analysis work and a lighter model for the live widget. Verify current free terms and limits before relying on any provider. Free tiers may log or train on prompts, so use only demo data and say so in the README. Check an embedding model's output dimension before using it: the column is fixed at 768.

---

# PHASE 0: Repository foundation

### P0-01 Monorepo skeleton
Goal: empty workspace every later chunk plugs into.
- [x] pnpm workspaces (`apps/*`, `packages/*`), Turborepo (`build lint test typecheck dev`), `.nvmrc`, `.editorconfig`, `.gitignore`
- [x] Empty packages: `packages/shared`, `packages/db`, `packages/config`
**Done:** `pnpm i && pnpm turbo run typecheck` passes.

### P0-02 TypeScript, ESLint, Prettier
- [x] Strict base tsconfig in `packages/config` (`noUncheckedIndexedAccess`), shared ESLint flat config, Prettier
**Done:** a deliberately bad file fails `pnpm lint`.

### P0-03 Git hooks and commit rules
- [x] Husky + lint-staged + commitlint (Conventional Commits), PR and issue templates
**Test:** a bad commit message is rejected. **Done:** hooks install on `pnpm i`.

### P0-04 Typed environment config
- [x] Zod `env` module that crashes on invalid config, `.env.example` (all variables), `docs/devlog.md`, `docs/versions.md`
**Test:** unit test valid/invalid env. **Done:** no `process.env` outside the config module.

---

# PHASE 1: Docker and CI/CD first

### P1-01 Local services
- [ ] `docker-compose.yml`: pgvector Postgres (healthcheck, volume, init script `CREATE EXTENSION vector`), Mailpit; ports on 127.0.0.1
**Done:** `docker compose up -d` is healthy and `\dx` lists `vector`.

### P1-02 Minimal API and Dockerfile
- [ ] Express 5 app with `GET /health/live` only; multi-stage, non-root Dockerfile with `HEALTHCHECK`; `.dockerignore`
**Test:** Supertest on health. **Done:** image builds and responds.

### P1-03 Minimal web and Dockerfile
- [ ] Next.js (App Router, Tailwind) with one placeholder page; standalone-output Dockerfile
**Done:** image builds and serves the page.

### P1-04 CI workflow
- [ ] `.github/workflows/ci.yml`: pnpm cache, install, lint, typecheck, test, build, Docker build (no push); concurrency cancel; branch protection on `main`
**Done:** a failing test blocks merging; CI badge in README.

### P1-05 CD workflow
- [ ] `deploy.yml` on `main`: push images to GHCR (tag = commit SHA), Trivy scan, call deploy hook, smoke test `/health/live`; secrets in GitHub Environments
**Done:** workflow runs green with a dry-run target.

### P1-06 First free deployment
- [ ] Create Neon, Render, Vercel projects; set env vars; deploy the skeleton; record URLs in README
**Done:** merging to `main` updates the live skeleton automatically.

---

# PHASE 2: Database (Prisma ORM 8)

### P2-01 Install and configure Prisma 8
- [ ] In `packages/db`: `@prisma/orm-postgres`, `pg`, `dotenv`; dev `prisma`, `tsx`, `typescript`, `@types/pg`; `prisma.config.ts` (contract path, `DATABASE_URL`); scripts `db:emit`, `db:plan`, `db:migrate`
- [ ] Read https://www.prisma.io/docs/llms.txt and note the exact current commands in `docs/adr/001-prisma-8.md`
**Done:** `pnpm db:emit` runs on a one-model contract.

### P2-02 Contract and baseline migration
- [ ] Copy `contract.prisma` into `packages/db/prisma/`; `db:emit`; `db init` on a fresh dev database, then commit `migrations/`
**Done:** tables exist; `prisma migration status` is up to date.

### P2-03 Hand-authored migration extras
- [ ] Use `prisma migration new` to add: HNSW index on `Chunk.embedding` (cosine), GIN index on `to_tsvector('simple', content)`, partial unique index "one live Subscription per org", composite FKs for optional `Ticket/Lead.conversationId`
**Test:** inserting two live subscriptions for one org fails. **Done:** migration applies cleanly from empty.

### P2-04 DB client and repository base
- [ ] `packages/db` exports a client factory (`postgres({ contract, url })`) and a `BaseRepository` that requires `organizationId` and excludes `deletedAt` rows
- [ ] Helper to generate ids (cuid2) for raw SQL inserts
**Done:** repositories cannot be called without `organizationId` (type error).

### P2-05 Seed
- [ ] Idempotent seed: platform admin, demo org, owner, one bot
**Done:** running twice creates no duplicates.

### P2-06 Test harness
- [ ] Vitest `unit` and `integration` projects; Testcontainers Postgres with pgvector; migrate once per run, truncate per test; factories (`createUser`, `createOrg`, `createBot`)
**Done:** one integration test creates and reads a user.

---

# PHASE 3: API foundation

### P3-01 App/server split and middleware chain
- [ ] `app.ts` (build) vs `main.ts` (listen); request-id, pino-http, helmet, CORS allowlist, JSON body limit, cookie-parser
**Done:** `pnpm --filter api dev` hot-reloads.

### P3-02 Errors and validation
- [ ] `AppError`, central error middleware (no stack traces in production), `validate({body,query,params})` with Zod, consistent `{ error: { code, message, details } }`
**Test:** 400 with field errors; unknown route 404 JSON.

### P3-03 Health and readiness
- [ ] `/health/ready` checking the database
**Done:** returns 503 when the DB is down (tested).

### P3-04 Rate limiting
- [ ] `rate-limiter-flexible` (memory store): global limiter + strict limiter preset for auth routes; limits from env
**Test:** 11th login attempt in a minute returns 429.

### P3-05 Pagination and filtering helper
- [ ] Shared `paginationSchema` and `paginate()` (page/limit or cursor, sort, search) used by every list endpoint
**Done:** documented in `docs/api.md`.

---

# PHASE 4: Authentication

### P4-01 Registration and organization bootstrap
- [ ] `POST /auth/register`: Zod, normalized email, Argon2id, create User + Organization + OWNER membership in one transaction
**Test:** duplicate email; rollback on failure.

### P4-02 Email sender and verification
- [ ] Mailer with `EMAIL_MODE=smtp|console`; random token stored as SHA-256 hash with expiry; `POST /auth/verify-email`; single use
**Test:** expired and reused tokens fail.

### P4-03 Login and access token
- [ ] `POST /auth/login` (verify password, block unverified/disabled users), 15-minute access JWT via `jose`, update `lastLoginAt`
**Test:** wrong password and tampered token → 401.

### P4-04 Refresh rotation and reuse detection
- [ ] Opaque refresh token in httpOnly+Secure+SameSite cookie, stored hashed with `familyId`; `POST /auth/refresh` rotates it; reuse of a used token revokes the family
**Test:** replay revokes family.

### P4-05 Logout
- [ ] `POST /auth/logout`, `POST /auth/logout-all`
**Done:** revoked tokens cannot refresh.

### P4-06 Password reset
- [ ] `forgot-password` (always 200), `reset-password` (revokes all refresh tokens)
**Test:** full flow via Mailpit.

### P4-07 Profile and `authenticate` middleware
- [ ] `GET/PATCH /auth/me`, `POST /auth/change-password`; `authenticate` attaches typed `req.auth`
**Test:** 401 without/with bad token, 200 with valid.

---

# PHASE 5: Tenancy and authorization

### P5-01 Permission map
- [ ] In `packages/shared`: roles, permissions, role→permission matrix, `can(role, permission)`
**Test:** table-driven matrix test.

### P5-02 `loadOrg` and `requirePermission`
- [ ] `/orgs/:orgId/...` routes: verify membership, attach `req.org` + role, reject soft-deleted or suspended orgs; `requirePermission('x:y')`
- [ ] Route-inventory test: every mounted route declares its guard
**Done:** user A cannot reach org B even with a valid token.

### P5-03 Organization endpoints
- [ ] Create, list mine, get, update name/slug
**Test:** isolation + permission tests.

### P5-04 Invitations
- [ ] Invite by email (hashed expiring token), accept, revoke, list pending
**Test:** flow via Mailpit.

### P5-05 Member management
- [ ] Change role, remove member; the last OWNER cannot be removed or demoted
**Test:** role matrix and last-owner guard.

### P5-06 Audit log
- [ ] `audit.record()` on sensitive actions; `GET /orgs/:orgId/audit-logs` (owner/admin, paginated)
**Done:** invites, role changes, bot deletes are logged.

### P5-07 Organization soft delete and restore
- [ ] `DELETE /orgs/:orgId` sets `deletedAt` + `purgeAfter`; hidden from all reads; restore endpoint (platform admin or owner within the window)
**Test:** deleted org returns 404 to members.

### P5-08 Tenant isolation test suite
- [ ] Generic test: for each tenant endpoint, user from org A requests org B's ids → 404/403
**Done:** runs in CI; an unscoped new endpoint fails the build.

---

# PHASE 6: Platform admin (required actor)

### P6-01 Platform admin guard and bootstrap
- [ ] `requirePlatformAdmin`; script/seed to promote the first admin; admin actions always write `AuditLog` with `actorType=platform_admin`
**Test:** normal user gets 403.

### P6-02 Organizations (admin API)
- [ ] `GET /admin/orgs` (search, status, paginate), `GET /admin/orgs/:id` (members, plan, usage, jobs count)

### P6-03 Suspend, restore, purge
- [ ] Suspend/unsuspend org; restore soft-deleted org; manual purge with confirmation
**Test:** suspended org's members and widget are blocked.

### P6-04 Users (admin API)
- [ ] List/search users, disable/enable (`disabledAt`), force logout (revoke refresh tokens)

### P6-05 Plan override
- [ ] Admin can grant a complimentary plan or limit override for an org (stored on org, respected by entitlements later)

### P6-06 Admin audit and jobs views (API)
- [ ] `GET /admin/audit-logs`, `GET /admin/jobs` (`ProcessingJob`, filter by status)

---

# PHASE 7: Dashboard foundation

### P7-01 App shell
- [ ] shadcn/ui, dark mode, toasts; layouts: marketing, auth, dashboard (sidebar, topbar)

### P7-02 API client and TanStack Query
- [ ] Typed `apiFetch` (credentials, error normalization, single-flight refresh on 401), query-key factory, default stale times, global error toast
**Test:** MSW test for 401 → refresh → retry.

### P7-03 Auth pages
- [ ] Register, login, verify-email, forgot/reset (React Hook Form + Zod)
**Test:** Playwright register→verify→login.

### P7-04 Route protection and session
- [ ] Next middleware cookie check + server-side session in dashboard layout; `useSession`

### P7-05 Organization context and `<Can>`
- [ ] Org switcher, `useOrg`, `<Can permission>` using the shared matrix
**Done:** VIEWER sees no write actions; API still rejects forged calls.

### P7-06 Members UI
- [ ] TanStack Table (sort, filter, paginate), invite dialog, change role, remove

### P7-07 Platform admin UI
- [ ] `/admin`: orgs table + detail, suspend/restore, users, audit log, jobs; reachable only by `PLATFORM_ADMIN`

---

# PHASE 8: Bots

### P8-01 Bots API
- [ ] CRUD under `/orgs/:orgId/bots`: `publicKey`, `allowedDomains` (validated hostnames), `systemPrompt`, `welcomeMessage`, `theme`, `enabledTools`, `embeddingModel` from env, soft delete
**Test:** CRUD, isolation, invalid domains.

### P8-02 Bots list UI
- [ ] Table with status toggle (optimistic update with rollback), create/delete

### P8-03 Bot settings and install snippet
- [ ] Settings form with live appearance preview; "Install" tab showing `<script src=".../widget.js" data-bot-id="…" async>`

---

# PHASE 9: AI provider layer

### P9-01 `LLMProvider` interface and fake provider
- [ ] Interface: `chat`, `stream`, tool calling, usage (tokens), abort support; deterministic `fake` provider (scriptable tool calls)
**Test:** fake streams tokens and tool calls.

### P9-02 OpenAI-compatible adapter
- [ ] One adapter with `baseURL` + key for **NVIDIA API Catalog, OpenRouter, Groq, Ollama**; map errors/rate limits to typed errors
**Test:** MSW-mocked responses.

### P9-03 Gemini adapter
- [ ] Gemini chat + streaming + tool calling behind the same interface

### P9-04 Embedding provider
- [ ] `EmbeddingProvider` (`gemini` @768, `ollama`, `fake`); batching, retry with backoff for free-tier limits; dimension check (must be 768)

### P9-05 Model routing and fallback
- [ ] Choose model per task (`agent`, `chat`, `batch`) from env; one fallback provider on 429/5xx; log model, tokens, latency
**Test:** primary fails → fallback used.

### P9-06 Provider smoke script
- [ ] `pnpm ai:smoke` prints a reply, a tool call, and an embedding length for the configured providers

---

# PHASE 10: Knowledge ingestion

### P10-01 Upload API (files and text)
- [ ] `POST /bots/:id/documents`: multer memory storage, size cap, MIME + magic-byte check (`file-type`), sha256 checksum (dedupe per bot), `Document(PENDING)` with `mimeType`, `fileSize`, `checksum`
**Test:** renamed `.exe` rejected; duplicate rejected.

### P10-02 URL source with SSRF guard
- [ ] Add-URL endpoint; safe fetcher: http/https only, resolve DNS and block private/loopback/link-local, redirect/size/time limits
**Test:** `169.254.169.254` and `localhost` refused.

### P10-03 Worker and job tracking
- [ ] `apps/worker` on pg-boss; `WORKER_MODE=inline|separate`; enqueue helper writes `ProcessingJob`; retries with backoff; graceful SIGTERM
**Test:** killed mid-job → retried; failure stores `errorCode`.

### P10-04 Text extraction
- [ ] PDF (`unpdf`), DOCX (`mammoth`), TXT/MD, HTML (`cheerio` + readability); fill `extractedText`, `processingStartedAt`, `processedAt`
**Test:** fixture per type.

### P10-05 Chunker
- [ ] ~500–800 tokens, 10–15% overlap, paragraph/heading-aware; keep `position`, `pageNumber`
**Test:** size/overlap unit tests.

### P10-06 Embed and store
- [ ] Embed chunks in batches, insert with raw SQL (supply ids), set `chunkCount`, status `READY`/`FAILED`
**Test:** vector round-trip integration test.

### P10-07 Re-index and delete
- [ ] Idempotent re-index (delete old chunks first), soft delete document and remove its chunks

### P10-08 Knowledge UI
- [ ] Documents table with status badges (polling), dropzone, add URL/text, re-index, delete, show `chunkCount`/errors
**Test:** Playwright upload → `READY`.

---

# PHASE 11: RAG chat

### P11-01 Vector retrieval
- [ ] `retrieve(orgId, botId, query, k)` by cosine similarity; tenant + bot filter **inside the SQL**; return scores
**Test:** known answers appear in top 3.

### P11-02 Hybrid retrieval
- [ ] Add full-text rank and merge with Reciprocal Rank Fusion
**Test:** keyword-heavy query improves vs vector-only.

### P11-03 Grounded prompt, citations, fallback
- [ ] Numbered sources, "answer only from context", context wrapped as untrusted data, structured citations, low score → "I don't know, talk to a human?"
**Test:** out-of-scope question triggers fallback.

### P11-04 Streaming endpoint
- [ ] SSE events `token`, `citations`, `done`, `error`; abort cancels the upstream call
**Test:** integration reads the stream; abort test.

### P11-05 Conversation persistence
- [ ] Save `Conversation` and `Message` (model, tokens, latency, `retrievalScore`)

### P11-06 Playground UI
- [ ] Dashboard chat with streaming, citation chips, debug panel of retrieved chunks

### P11-07 Feedback
- [ ] 👍/👎 on messages saved to `Message.feedback`

---

# PHASE 12: Widget and public API

### P12-01 Visitor session
- [ ] `POST /public/v1/session`: `botKey` + `Origin` must match `allowedDomains` → short-lived visitor token
**Test:** wrong origin 403.

### P12-02 Public chat endpoint
- [ ] `POST /public/v1/chat` (SSE) with visitor token, per-IP/session rate limits, CORS only for that bot's domains, quota hook for billing
**Test:** tampered token 401, flood 429.

### P12-03 Widget core
- [ ] Preact + Vite IIFE bundle; reads `data-bot-id`; Shadow DOM; launcher + chat; streaming; persists conversation id in `localStorage` (try/catch)
**Done:** works on a plain HTML test page.

### P12-04 Widget UI polish
- [ ] Safe markdown, citation links, theme from bot config, mobile layout, keyboard accessibility; bundle-size check in CI (< ~50 KB gz)

### P12-05 Embedding guide
- [ ] Docs page for HTML, Next.js and a small WordPress snippet; test on two different origins

### P12-06 Hosted help page (optional)
- [ ] `/help/[botKey]` full-page chat

---

# PHASE 13: AI agent

### P13-01 Tool framework
- [ ] `ToolDefinition` (Zod input, `requiresConfirmation`, `execute(ctx,input)`), registry filtered by `Bot.enabledTools`, ctx built from the server only

### P13-02 Bounded agent loop
- [ ] Model call → tool call → execute → repeat (max 5 steps); every call logged to `ToolCall`; tool errors returned to the model safely
**Test:** scripted fake LLM; step limit.

### P13-03 `create_ticket` tool
### P13-04 `capture_lead` tool
- [ ] Validated email, consent wording, stored in `Lead`

### P13-05 `handoff_to_human` tool
- [ ] Sets conversation `NEEDS_HUMAN`, notifies team (placeholder until P15-03)

### P13-06 `lookup_order` webhook tool
- [ ] Tenant-configured URL; HMAC-signed request, timeout, SSRF guard, response schema validation

### P13-07 Confirmation flow
- [ ] Side-effect tools create `PENDING_CONFIRMATION`; widget shows Yes/No; only then execute
**Test:** reject path never executes.

### P13-08 Tool settings UI
- [ ] Per-bot toggles, webhook URL + write-only secret, test button, recent tool calls table

---

# PHASE 14: Tickets and human inbox

### P14-01 Tickets API
- [ ] Status, priority, assignee, notes; filters and pagination

### P14-02 Tickets UI
- [ ] TanStack Table with server-side pagination/filters, detail drawer, assign/resolve

### P14-03 Inbox list and unread
- [ ] Conversations sorted `NEEDS_HUMAN` first; unread = `lastMessageAt > agentLastReadAt`; mark read

### P14-04 Takeover and live replies
- [ ] Atomic claim sets `assignedToId` + `HUMAN_ACTIVE`; bot stops; agent messages stream to the visitor over SSE; track `visitorLastSeenAt`
**Test:** Playwright with two browser contexts; two agents claiming → one wins.

### P14-05 Release and close
- [ ] Release back to bot, close conversation, set `closedAt`/`firstResponseAt`

---

# PHASE 15: Workflow automation

### P15-01 Summary and sentiment job
- [ ] Delayed pg-boss job after idle/close; structured JSON (Zod-validated, one repair retry); saves `summary`, `sentiment`

### P15-02 Tags and resolution
- [ ] Topic tags and resolved/unresolved flag; show in inbox

### P15-03 Notifications
- [ ] Slack webhook + email for handoffs and high-priority tickets; per-org settings

### P15-04 Knowledge gaps
- [ ] Low `retrievalScore` or 👎 → grouped questions page with "Add answer" (creates a text document)

### P15-05 Weekly digest
- [ ] Scheduled pg-boss job emailing top questions, unanswered count, usage

---

# PHASE 16: Billing and subscriptions

### P16-01 Plans config
- [ ] `packages/shared/plans.ts`: Free/Pro/Business limits and features; Stripe test products and price ids in env

### P16-02 Checkout
- [ ] `POST /billing/checkout` (`billing:manage`), metadata carries `orgId`; pricing page

### P16-03 Customer portal and billing page
- [ ] `POST /billing/portal`; billing page showing current plan

### P16-04 Webhook receiver
- [ ] Raw body, signature verification, persist `WebhookEvent` first (idempotent), status RECEIVED → PROCESSED/FAILED
**Test:** bad signature 400, duplicate ignored.

### P16-05 Subscription sync and history
- [ ] Handle checkout/subscription/invoice events; many `Subscription` rows over time, one live; append `SubscriptionEvent` on each change; re-fetch from Stripe if events arrive out of order; billing history UI
**Test:** upgrade then downgrade → two history rows.

### P16-06 Entitlements
- [ ] `entitlements.check(orgId, metric)` used by chat, upload, bot create, invite; respects admin plan override

### P16-07 Usage metering
- [ ] Atomic monthly `UsageRecord` increments (messages, tokens, documents, bots, seats)
**Test:** parallel requests near the limit.

### P16-08 Usage UI and limit UX
- [ ] Usage bars, 80% warning, friendly widget message at 100%

---

# PHASE 17: Analytics and business assistant

### P17-01 Metrics API
- [ ] Conversations/day, handoff rate, resolution rate, first-response time, top tags, tokens and cost, feedback ratio
**Test:** seeded data → exact numbers.

### P17-02 Analytics dashboard
- [ ] Recharts cards/charts, date range, caching

### P17-03 Assistant tools
- [ ] Predefined, parameterized tools: `get_metrics`, `search_conversations`, `list_knowledge_gaps` (no raw SQL), `analytics:read` only

### P17-04 Business assistant chat
- [ ] Owner chat using the agent model (`LLM_AGENT_MODEL`), rate-limited, cost-logged

---

# PHASE 18: Security hardening

### P18-01 Prompt-injection test suite
- [ ] 15+ adversarial prompts and poisoned documents; must not leak the system prompt or trigger tools

### P18-02 Output safety and caps
- [ ] Sanitize rendered markdown, cap message length, history size and output tokens

### P18-03 Log hygiene
- [ ] PII redaction helper; no message bodies at info level in production

### P18-04 Headers, CORS, cookies
- [ ] CSP/security headers on web, CORS allowlists, Secure cookies; checklist in `docs/security.md`

### P18-05 Dependency and secret scanning
- [ ] `pnpm audit` in CI, Dependabot/Renovate, secret scanning, Trivy already on images

### P18-06 Organization purge job
- [ ] Scheduled job hard-deletes orgs past `purgeAfter` (cascade), audit-logged

### P18-07 Row-level security (optional)
- [ ] Postgres RLS with `SET LOCAL app.org_id` as a second tenant barrier

---

# PHASE 19: Test system

### P19-01 Coverage gates
- [ ] Thresholds on `auth`, `billing`, `agent`, `tenancy` modules; coverage report in CI

### P19-02 Playwright setup and auth path
- [ ] Fake LLM in CI; register → verify (Mailpit API) → login → logout

### P19-03 Knowledge and chat paths
- [ ] Create bot → upload → `READY` → playground answer with citation

### P19-04 Widget path
- [ ] Embed on a static page, ask a question; blocked on a non-allowed origin

### P19-05 Handoff path
- [ ] Visitor requests human → agent takes over → both see messages

### P19-06 Roles and platform admin path
- [ ] Viewer cannot write; platform admin suspends an org and members are blocked

### P19-07 RAG eval dataset
- [ ] `evals/dataset.json`: 30+ questions with expected facts and source docs

### P19-08 Eval runner
- [ ] `pnpm eval`: hit@k, expected-fact match, refusal accuracy, latency, tokens; table output; history in `docs/eval-history.md`

---

# PHASE 20: Observability

### P20-01 Error tracking
- [ ] Sentry in API, worker, web

### P20-02 Correlated logging
- [ ] Request-id propagated into jobs; structured JSON logs with `orgId`/`userId`

### P20-03 Cost tracking
- [ ] Per-tenant token/cost view for platform admin; daily spend cap with alert

### P20-04 Uptime and metrics
- [ ] Uptime monitor on `/health/ready`; optional `/metrics` counters

---

# PHASE 21: Production and portfolio

### P21-01 Production release checklist
- [ ] Migrations run as a release step (not on boot), env audit, rollback by redeploying the previous SHA, smoke test in `deploy.yml`

### P21-02 Demo tenant
- [ ] Seed a fictional company knowledge base, public demo page and demo login with fake data

### P21-03 Runbook
- [ ] `docs/runbook.md`: deploy, rollback, restore from backup, rotate secrets, handle cold starts

### P21-04 README
- [ ] Pitch, live demo, credentials, screenshots/GIF, Mermaid architecture, run locally in 3 commands, CI badge, security notes, limitations

### P21-05 ADRs
- [ ] 6–8 short decisions: monorepo, Prisma 8, pgvector, own auth, SSE, pg-boss, RBAC, hybrid search, model routing

### P21-06 Demo video and case study
- [ ] 2–3 minute video (embed on a WordPress site), case study page on DevSparkr, resume bullets