# CONTEXT.md

Shared vocabulary for the MediCore API. Use these terms exactly when
discussing or generating code. Updating this file is the fastest way to
make new agent sessions productive.

---

## 1. Product shape

- **MediCore**: a multi-tenant REST API for clinics and healthcare centers.
- **Tenant** (a.k.a. **organización**, **org**): one clinic. Every business
  row in the database belongs to exactly one tenant. The tenant's ID lives
  in `organizacion_id`.
- **Workspace root**: `medcore_apis/`. Every npm script runs from here.

### Stack

Fastify 5 + TypeScript 6 (strict, ESM) + Prisma 7 + PostgreSQL + `@fastify/jwt`.

---

## 2. Modules (the 11 business domains)

Each domain lives under `src/modules/<name>/`. Existing ones with HTTP routes:

| Module            | Prefix                  | Purpose                              |
|-------------------|-------------------------|--------------------------------------|
| `auth`            | `/api/auth`             | login, logout, refresh, me           |
| `organizaciones`  | `/api/organizaciones`   | CRUD of tenants                      |
| `roles`           | `/api`                  | Roles, permissions, templates        |
| `sedes`           | `/api`                  | **Sedes** and **consultorios**       |
| `usuarios`        | `/api`                  | Users inside a tenant                |
| `disponibilidad`  | `/api/disponibilidad`   | Availability rules + calendar        |
| `audit-log`       | `/api`                  | Query the audit log                  |

### Spanish domain glossary

These terms appear in routes, code, and DB tables. **Do not translate them.**

- **Sede**: a physical clinic location. A tenant can have multiple sedes.
- **Consultorio**: an exam/treatment room inside a sede.
- **Paciente**: patient.
- **Agenda / Cita**: schedule / appointment.
- **HCE** (*Historia Clínica Electrónica*): the EHR / patient chart.
- **Encuentro**: a clinical encounter (one visit, one HCE entry).
- **Facturación**: billing.
- **Factura**: invoice. Has FEL support (see §11).
- **Inventario**: inventory.
- **Telemedicina**: telemedicine.
- **Seguimiento**: patient follow-up.
- **Descuentos**: discounts.
- **Compras**: purchasing.
- **Médico, secretaria, enfermería**: doctor, secretary, nursing — the three
  non-admin role templates.

### Use case IDs

Use cases are identified as **`UC-<DOMAIN>-<NUMBER>`**. The domain catalog
lives in `references/use-cases.md`. Examples:

- `UC-CORE-001` to `UC-CORE-...`: core platform (auth, tenants, roles).
- `UC-AGE-...`: agenda (scheduling).
- `UC-FACT-...`: facturación.
- `UC-REP-...`: reportes.

Commits reference the use case: `[UC-CORE-001] feat: descripción`.

---

## 3. Module file structure (four-file rule)

Every module has exactly these four files:

- **`<name>.routes.ts`** — Fastify plugin: registers routes with schemas
  and `preHandler` hooks (auth + RBAC).
- **`<name>.controller.ts`** — Parses the request, calls the service,
  returns `sendOk` / `sendFail`. **Never** contains business logic.
- **`<name>.service.ts`** — Business logic and Prisma queries. Throws
  `HttpError` on business errors.
- **`<name>.schemas.ts`** — TypeScript types + JSON Schemas. JSON Schemas
  are used both for runtime validation and for OpenAPI docs.

---

## 4. Core infrastructure (`src/core/`)

- **`config/prisma.ts`**: singleton **PrismaClient**. Import as
  `import prisma from '../../config/prisma.js'`. Never `new PrismaClient()`.
- **`core/env.ts`**: **`AppEnv`** — validated environment variables.
- **`core/errors.ts`**: **`HttpError`** — the only error class business
  code should throw. Signature: `new HttpError(statusCode, code, message)`.
- **`core/http/response.ts`**: **`sendOk`** and **`sendFail`** — the only
  way to respond. Never `reply.send()` directly.
- **`core/audit/auditLog.ts`**: **`writeAuditLog`** — the audit helper.
- **`core/auth/requireAuth.ts`**: **`requireAuth`** — Fastify hook that
  validates the JWT and populates `request.user`.
- **`core/auth/requirePermission.ts`**: **`requirePermission`** — RBAC
  hook factory. Usage: `requirePermission('agenda', 'crear')`.
- **`core/plugins/auditAccess.ts`**: logs every HTTP response (separate
  from `writeAuditLog`).
- **`core/plugins/errorHandler.ts`**: global error handler that converts
  `HttpError` and Zod errors into `sendFail`.
- **`core/plugins/openapi.ts`**: Swagger + Scalar at **`/docs`**.
- **`core/plugins/requestContext.ts`**: injects **`request.requestId`**.

---

## 5. Multi-tenancy (the most important rule)

**Every query** must filter by `organizacion_id` of the active tenant.

- **`tenantOrgId`**: the variable name we use for the active tenant ID.
- **Source of truth**: `request.user.organizacion_id` (from the JWT).
  **Never** trust `request.body.organizacion_id`.

```ts
// ✅
prisma.tabla.findMany({ where: { organizacion_id: tenantOrgId, deleted: false } })

// ❌
prisma.tabla.findMany({ where: { organizacion_id: request.body.organizacion_id } })
```

### Paciente exception

`paciente` has **no direct `organizacion_id`**. Tenant ownership is
expressed through the **`paciente_organizacion`** join table (one
patient may belong to several tenants over their life). To verify
tenant ownership of a patient, look up the join row first.

---

## 6. Soft deletes (the second most important rule)

Every business table has `deleted: Boolean` and `deleted_at: DateTime?`.

- **Reading**: always filter `deleted: false`.
- **Deleting**: `update` the row to `{ deleted: true, deleted_at: new Date() }`.
- **Never** call `prisma.tabla.delete()`. Hard deletes are forbidden.

---

## 7. Response envelope

Every response goes through `sendOk` / `sendFail`. Format:

```json
// Success
{ "success": true, "data": {...}, "meta": { "requestId": "uuid" } }

// Failure
{ "success": false,
  "error": { "code": "NOT_FOUND", "message": "..." },
  "meta": { "requestId": "uuid" } }
```

Standard error codes: `VALIDATION_ERROR` (400), `NOT_FOUND` (404),
`CONFLICT` (409), `FORBIDDEN` (403), `UNAUTHORIZED` (401).

---

## 8. Audit log (`writeAuditLog`)

Mandatory for any **create / update / delete** of business data, plus
**login**, **logout**, **refresh**, **permission changes**, **financial
operations** (invoices, payments), and **clinical operations**
(encuentros, prescripciones, firmas).

Standard `accion` values: **`crear`**, **`actualizar`**, **`eliminar`**,
**`login`**, **`logout`**, **`aprobar`**, **`rechazar`**, etc.

The audit row records `datosAntes` and `datosDespues` — pass the full
before/after row, not just the diff.

---

## 9. Auth & RBAC

### JWT payload (on `request.user`)

- **`sub`**: the `usuario_id` (UUID).
- **`organizacion_id`**: the active tenant.
- **`rol_id`**: the role assigned to the user.
- **`permisos`**: the role's permissions tree (see below).

### Permissions tree (`rol.permisos`)

A JSON object keyed by module:

```json
{
  "usuarios": "*",
  "agenda": ["leer", "crear", "editar"],
  "reportes": true,
  "facturacion": false
}
```

- `"*"` or `true` → full access to the module.
- Array → only those actions.
- `false` → no access.

### Role templates

`admin`, `medico`, `secretaria`, `enfermeria`. Defined in
`src/modules/roles/role.templates.ts`.

### preHandler patterns

- `[requireAuth]` — auth only.
- `[requireAuth, requirePermission('mod')]` — auth + any access to module.
- `[requireAuth, requirePermission('mod', 'accion')]` — auth + specific
  action.

---

## 10. Auth flow

| Endpoint                | Returns                                                  |
|-------------------------|----------------------------------------------------------|
| `POST /api/auth/login`  | `{ accessToken, refreshToken, expiresIn, usuario }`      |
| `POST /api/auth/refresh`| Rotates refresh, returns new tokens                      |
| `POST /api/auth/logout` | Revokes the refresh token                                |
| `GET /api/auth/me`      | Authenticated user data                                  |

- **Access token**: a JWT. Lifetime: `JWT_ACCESS_EXPIRES_IN` (default `15m`).
- **Refresh token**: opaque (not a JWT), **hashed in DB**, rotated on every
  use. Lifetime: `JWT_REFRESH_DAYS` (default `7`).

---

## 11. FEL (Factura Electrónica — Guatemala)

The `factura` table supports SAT-certified electronic invoicing.

- **Borrador**: draft invoice with items.
- **Emitida**: certified and active.
- **Certificador FEL**: the external service that signs the invoice.
  Configured per tenant in `organizacion.certificador_fel`.
- **`fel_uuid`**: the UUID returned by the certifier.
- **`fel_pdf_url`, `fel_xml_url`**: links to the certified docs.
- **`organizacion.correlativo_fel`**: the running counter incremented on
  each emission.
- **`organizacion.serie_fel`**: the invoice series for this tenant.

Standard flow: create as `borrador` → build XML → send to certificador →
receive `fel_uuid` + URLs → update to `emitida`.

---

## 12. Prisma schema patterns

Every business table follows these conventions:

```prisma
id              String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
organizacion_id String   @db.Uuid                            // multi-tenant FK
created_at      DateTime? @default(now()) @db.Timestamp(6)
updated_at      DateTime? @default(now()) @db.Timestamp(6)
deleted         Boolean?  @default(false)                    // soft delete
deleted_at      DateTime? @db.Timestamp(6)
```

- IDs are **UUIDv4 generated in the DB** via `uuid_generate_v4()`.
- Datetimes are `Timestamp(6)` (microsecond precision).
- The reference catalog is **54 tables**, fully documented in
  `references/data-dictionary.md`.

---

## 13. Pagination & search (standard pattern)

Every list endpoint accepts:

```ts
type SearchQuery = {
  campo?: string;
  page?: number;       // default 1
  pageSize?: number;   // default 20
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';  // default 'desc'
};
```

Response shape:

```json
{ "items": [...],
  "pagination": { "page": 1, "pageSize": 20, "total": 100, "totalPages": 5 },
  "sort": { "sortBy": "created_at", "sortOrder": "desc" },
  "filters": { "campo": "..." } }
```

Implementation: `prisma.$transaction([count, findMany])`.

---

## 14. Prisma transactions

- **Callback transaction**: for interdependent operations.
  ```ts
  await prisma.$transaction(async (tx) => { /* ... */ });
  ```
- **Batch transaction**: for independent operations dispatched together.
  ```ts
  await prisma.$transaction([op1, op2, op3]);
  ```

---

## 15. OpenAPI tagging

Every schema declares a **`tags: ['Dominio / Recurso']`** array. The slash
groups endpoints in the `/docs` UI. Examples: `'Pacientes / Gestión'`,
`'Agenda / Citas'`, `'Facturación / FEL'`.

---

## 16. Environment variables

| Variable                  | Default          | Notes                                |
|---------------------------|------------------|--------------------------------------|
| `DATABASE_URL`            | —                | Required in production.              |
| `JWT_SECRET`              | `dev-secret...`  | ≥32 chars in production.             |
| `PORT`                    | `3000`           |                                      |
| `JWT_ACCESS_EXPIRES_IN`   | `15m`            |                                      |
| `JWT_REFRESH_DAYS`        | `7`              |                                      |
| `NODE_ENV`                | `development`    | `development` \| `production` \| `test` |

---

## 17. Reference docs (read these before coding a new module)

- **`references/use-cases.md`** — All 11 modules with full use case spec:
  actor, endpoints, tables, flow, BE notes.
- **`references/data-dictionary.md`** — Every column of every table:
  type, NN/PK/FK flags, enum values, relations.

Rule: **before writing code for a new module, read the use case + the
relevant tables**.

---

## 18. Common pitfalls

- **Forgot `prisma generate`**: after editing `schema.prisma`, run
  `npx prisma generate` or the types will be stale.
- **Missing tenant filter**: the query returns rows from other tenants.
  Always include `organizacion_id: tenantOrgId`.
- **Hard delete slipped in**: someone called `prisma.tabla.delete()`.
  Always use the soft-delete pattern.
- **Audit log missing**: a sensitive operation completed without
  `writeAuditLog`. Required for every mutation.
- **`reply.send()` used directly**: bypasses the response envelope.
  Always `sendOk` / `sendFail`.
- **Paciente queried by `organizacion_id`**: that column doesn't exist
  on `paciente`. Use `paciente_organizacion`.

---

## 19. Companion project (not part of this repo)

- **AssuredHub**: a separate Module Federation workspace (8 MFEs) that
  is unrelated to MediCore but shares the same maintainer. Vocabulary
  for that project lives in its own `CONTEXT.md`.

---

## How to use this file

1. When starting a new agent session in this repo, ensure this file is
   read before any non-trivial work.
2. When you catch yourself explaining a term to the agent, add it here.
3. Prefer adding to this file over expanding the main SKILL.md — this
   is the one place agents always read.
4. Keep entries short. One sentence per term when possible. The detail
   lives in the main SKILL.md and in `references/*`; this file just
   decodes the jargon.
