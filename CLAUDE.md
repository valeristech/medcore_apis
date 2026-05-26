# CLAUDE.md

## Required reading

Before any non-trivial work in this repo, read **`CONTEXT.md`**. It is the
shared vocabulary (Spanish domain glossary, multi-tenancy rules, soft-delete
rules, FEL flow, use case ID format) used across the codebase.

CLAUDE.md (this file) describes **how the code is structured**.
CONTEXT.md describes **what the terms mean and what the invariants are**.
Both are required context.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MediCore is a multi-tenant healthcare management REST API built with Fastify + TypeScript + Prisma (PostgreSQL). It handles patient management, scheduling, billing, clinical documentation, and RBAC.

## Commands

```bash
# Development (hot reload via tsx watch)
npm run dev

# Type checking
npm run typecheck

# Build
npm run build          # runs prisma generate then tsc

# Start production server
npm run start

# Database
npm run db:deploy      # deploy pending migrations
npm run db:seed        # seed database

# Tests: not yet implemented
```

All commands run from `medcore_apis/`.

## Architecture

### Module Structure

Each domain feature under `src/modules/` is a self-contained Fastify plugin with this internal layout:

```
modules/<name>/
  <name>.routes.ts      # Fastify plugin: registers routes with schemas
  <name>.controller.ts  # Parses request, calls service, sends response
  <name>.service.ts     # Business logic + Prisma queries
  <name>.schemas.ts     # Zod/JSON Schema for request validation & OpenAPI
```

The app bootstraps in `src/app.ts`, which registers core plugins first (auth, error handler, rate limit, audit, OpenAPI) then all module routes under `/api`.

### Core Plugins (`src/core/plugins/`)

- `errorHandler.ts` — global Fastify error handler, converts `HttpError` and Prisma errors to HTTP responses
- `auditAccess.ts` — request/response logging hook
- `requestContext.ts` — injects `requestId` into each request
- `openapi.ts` — registers Swagger + Scalar interactive docs at `/docs`

### Shared Utils (`src/core/utils/`)

Reusable helper functions that would otherwise be duplicated across modules. **Never define these locally inside a service — always import from here.**

- `strings.ts` — `cleanStr(v: unknown): string | undefined` trims a string and returns `undefined` if empty; use for all optional text fields before persisting.
- `guatemala.ts` — `isValidCUI(dpi: string): boolean` validates the 13-digit Guatemalan DPI/CUI format.

When adding a new helper, ask: "Would another module ever need this?" If yes, it belongs in `src/core/utils/`.

### Enums (`src/core/enums/`)

Typed constants for fields that have a fixed set of valid values. **Never use inline string literals or union types like `'leve' | 'moderada' | 'grave'` — always define an enum and import it.**

- `paciente.enums.ts` — `Genero`, `SeveridadAlergia`, `GrupoSanguineo` (each with a matching `*_VALUES` array for use in JSON Schema `enum` properties).

Pattern for a new enum file:

```ts
export enum MiEnum {
  ValorA = 'valor_a',
  ValorB = 'valor_b',
}
export const MI_ENUM_VALUES = Object.values(MiEnum) as [string, ...string[]];
```

Then in `schemas.ts`:
```ts
import { MiEnum, MI_ENUM_VALUES } from '../../core/enums/mi.enums.js';

// In the TypeScript type:
campo?: MiEnum;

// In the JSON Schema property:
campo: { type: 'string', enum: MI_ENUM_VALUES }
```

### Authentication & Authorization

- **JWT**: `@fastify/jwt` with a 15-minute access token and a refresh token stored in DB
- `src/core/auth/requireAuth.ts` — Fastify hook that validates the JWT and attaches the decoded user to `request.user`
- `src/core/auth/requirePermission.ts` — hook factory for RBAC checks; permissions are stored as JSON on roles (e.g., `"auth.me"`, `"users.create"`)
- `src/core/auth/permissions.ts` — exhaustive list of all permission strings

### Database

Prisma schema is at `prisma/schema.prisma`. Key design decisions:
- **Multi-tenancy**: virtually every table has an `organizacion_id` FK; all service queries must scope by tenant
- **Soft deletes**: `deleted: Boolean` + `deleted_at` on most tables; always filter `deleted: false`
- **Audit log**: the `audit_log` table is written by `src/core/audit/auditLog.ts` for sensitive actions

### Response Format

All responses use `src/core/http/response.ts`:
```ts
{ success: boolean, data: T, meta: { requestId: string } }
```

### Error Handling

Throw `HttpError` (from `src/core/errors.ts`) with a status code, machine-readable `code`, and message. The global handler converts it to the standard response shape.

## Key Environment Variables

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | — | Required in production |
| `JWT_SECRET` | — | Min 32 chars in production |
| `PORT` | `3000` | |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | |
| `JWT_REFRESH_DAYS` | `7` | |
| `NODE_ENV` | `development` | |

## TypeScript Config

Strict mode, `moduleResolution: NodeNext`, target ES2022. Path aliases are not used — imports use relative paths.

## Commit Convention

Commits use Use Case prefixes:
```
[UC-CORE-001] feat: description
[UC-AGE-001] fix: description
```