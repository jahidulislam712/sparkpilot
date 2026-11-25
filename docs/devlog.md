# Development log

## P0-01: Monorepo skeleton

- Added pnpm workspaces, Turborepo tasks, Node 24 pinning, and shared workspace configuration.
- Added empty `shared`, `db`, and `config` packages for later chunks.

## P0-02: TypeScript, ESLint, Prettier

- Added strict shared TypeScript configuration and flat ESLint configuration.
- Added shared Prettier formatting and documented resolved tool versions.

## P0-03: Git hooks and commit rules

- Added Husky hooks for staged lint/format checks and Conventional Commit validation.
- Added pull request and issue templates for consistent chunk delivery.

## P0-04: Typed environment config

- Added Zod-validated environment parsing in `packages/config`.
- Added `.env.example` and unit tests for valid and invalid configuration.

## P1-01: Local services

- Added pgvector PostgreSQL 18 and Mailpit through Docker Compose.
- Bound local ports to loopback and added the `vector` extension init script.

## P1-02: Minimal API

- Added Express 5 app/server split with `/health/live`.
- Added Supertest health coverage and a multi-stage non-root Docker image.

## P1-03: Minimal web

- Added Next.js App Router placeholder with Tailwind 4.
- Added standalone Docker output and local container smoke verification.
