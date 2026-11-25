# AGENTS.md — SparkPilot by DevSparkr

Read this first, then implement **exactly one chunk** from `TASKS.md` per task/PR.

## Product
Multi-tenant AI support SaaS. Businesses subscribe, upload knowledge, embed a `<script>` widget, and get a RAG chatbot with agent tools and human handoff.
Actors: **Platform admin** (DevSparkr staff) · **Owner/Admin** · **Agent** · **Viewer** · **Visitor** (anonymous widget user).

## Version policy (important)
- Always install the **latest stable** release at the time you add a package (`pnpm add pkg@latest`), then record resolved versions in `docs/versions.md`. Do not rely on memory of old APIs: **read the current docs/release notes** before coding (Next.js, Express 5, React, Zod, TanStack Query/Table, Tailwind, Vite, Vitest, Playwright, Stripe SDK, pg-boss).
- **Prisma ORM 8** (what `npm install prisma` installs; release candidate). It is **not** Prisma 7: there is no `schema.prisma`, `@prisma/client`, `prisma generate`, `migrate dev` or `db push`. Use `contract.prisma`, `@prisma/orm-postgres`, `prisma contract emit`, `prisma migration plan`, `prisma db migrate`. Before writing DB code, read https://www.prisma.io/docs/llms.txt. Keep ALL database access inside `packages/db` so the ORM stays swappable.
- If Prisma 8 blocks a chunk, stop and report it in the PR. Fallback is Prisma 7 (`prisma@prev`).
- Node: current LTS that Prisma 8 supports (Node 24 recommended). Use it in `.nvmrc` and Dockerfiles.

## Stack (all free / free tier)
pnpm + Turborepo · TypeScript strict · Express 5 API · Next.js App Router dashboard · Prisma 8 + PostgreSQL + pgvector · **pg-boss** queue on Postgres (no Redis) · Zod · Preact widget · Vitest + Supertest + Testcontainers + Playwright · Docker · GitHub Actions + GHCR · Stripe **test mode**.

```
apps/api  apps/worker  apps/web  apps/widget
packages/db  packages/shared  packages/config
docs/{adr,devlog.md,versions.md}  evals/  .github/workflows/
```

## Commands
`pnpm i` · `pnpm dev` · `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm test:e2e` · `pnpm db:emit` · `pnpm db:plan --name x` · `pnpm db:migrate` · `pnpm db:seed` · `pnpm eval` · `docker compose up -d`
A chunk is done only when `lint`, `typecheck`, `test` and `build` pass.

## Rules (non-negotiable)
1. **Tenancy:** tenant queries go through repository helpers that REQUIRE `organizationId`. Never trust `organizationId`/`botId` from a request body without verifying it against the authenticated context. Child tables use composite FKs (see `contract.prisma`). Filter `deletedAt` in repositories.
2. **AuthN/AuthZ:** `authenticate` → `loadOrg` (membership) → `requirePermission('x:y')`. Check **permissions, not role names**. Platform routes use `requirePlatformAdmin`. Visitors use a separate short-lived token. Deny by default.
3. **Secrets:** never commit secrets; store only hashes of tokens (SHA-256) and passwords (Argon2id). All env goes through the Zod-validated `env` module.
4. **Validation/errors:** Zod schemas from `packages/shared` on every input; `AppError` envelope; no stack traces to clients.
5. **AI safety:** retrieved text and user messages are untrusted data, never instructions. Tool context (`orgId`, `botId`, `conversationId`) comes from the server, never from model output. Side-effect tools need confirmation. Agent loop max 5 steps.
6. **LLM access only via** `LLMProvider` / `EmbeddingProvider`. Providers: `nvidia | openrouter | groq | ollama | gemini | fake`. Tests/CI use `fake`. Embedding dimension is **768**. Never mix embedding models in one bot's index.
7. **Webhooks:** verify signature, persist event id first (idempotent), tolerate out-of-order events.
8. Prisma 8 generates ids client-side (`@onCreate(cuid(2))`): raw SQL inserts must supply ids.
9. No `any`, no `console.log` (use pino), no unexplained new dependency (one-line reason in PR).

## Testing rules
Same PR as the code: unit tests for pure logic, integration tests (real Postgres via Testcontainers) for routes, a tenant-isolation test for every new tenant endpoint, Playwright only for golden paths.

## Git
Branch `feat/<chunk-id>-<slug>` · Conventional Commits · PR title `P4-03: login with rotating refresh tokens` · PR body: acceptance criteria with ✅/❌ and how you tested.

## Definition of done (per chunk)
Acceptance met · tests added and green · CI green · 2–3 lines in `docs/devlog.md` · no unrelated changes.