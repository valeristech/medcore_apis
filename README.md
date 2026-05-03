# MediCore APIs

API REST multi-tenant para gestión de clínicas y centros de salud. Construida con **Fastify + TypeScript + Prisma (PostgreSQL)**.

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework HTTP | Fastify 5 |
| Lenguaje | TypeScript 6 (strict, ESM, NodeNext) |
| ORM | Prisma 7 + `@prisma/adapter-pg` |
| Base de datos | PostgreSQL |
| Auth | `@fastify/jwt` (access token 15m) + refresh token opaco en BD |
| Docs | Swagger + Scalar en `/docs` |
| Fechas/zonas | Luxon + IANA timezones |
| Bcrypt | `bcryptjs` |
| Rate limit | `@fastify/rate-limit` (300 req/min global) |
| Hot reload | `tsx watch` |

---

## Requisitos previos

- Node.js ≥ 20
- PostgreSQL corriendo y accesible
- Variables de entorno configuradas (ver sección siguiente)

---

## Variables de entorno

Crear un archivo `.env` en la raíz de `medcore_apis/`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/medicore
JWT_SECRET=una-clave-de-al-menos-32-caracteres-en-produccion
PORT=3000
NODE_ENV=development
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_DAYS=7
```

| Variable | Obligatoria en prod | Descripción |
|---|---|---|
| `DATABASE_URL` | ✅ | Cadena de conexión PostgreSQL |
| `JWT_SECRET` | ✅ (≥ 32 chars) | Secreto para firmar JWTs |
| `PORT` | No | Puerto HTTP (default `3000`) |
| `NODE_ENV` | No | `development` \| `production` \| `test` |
| `JWT_ACCESS_EXPIRES_IN` | No | Duración access token (default `15m`) |
| `JWT_REFRESH_DAYS` | No | Días de validez refresh token (default `7`) |

---

## Comandos principales

Todos los comandos se ejecutan desde `medcore_apis/`.

```bash
# Instalar dependencias
npm install

# Levantar en modo desarrollo (hot reload)
npm run dev

# Type-checking sin compilar
npm run typecheck

# Compilar a JS
npm run build

# Arrancar en producción
npm run start

# Desplegar migraciones pendientes (prod)
npm run db:deploy

# Seed inicial de la BD
npm run db:seed
```

### Prisma (workflow de desarrollo)

```bash
# Regenerar el cliente Prisma (obligatorio tras cambiar schema.prisma)
npx prisma generate

# Crear y aplicar una nueva migración
npx prisma migrate dev --name nombre_de_la_migracion

# Abrir Prisma Studio (explorador visual de BD)
npx prisma studio
```

---

## Estructura de carpetas

```
medcore_apis/
├── prisma/
│   ├── schema.prisma          # Modelo de datos completo
│   ├── seed.ts                # Seed inicial
│   └── migrations/            # Historial de migraciones SQL
├── src/
│   ├── server.ts              # Punto de entrada (carga dotenv, llama buildApp)
│   ├── app.ts                 # buildApp: registra plugins y rutas
│   ├── config/
│   │   └── prisma.ts          # Instancia singleton de PrismaClient
│   ├── core/
│   │   ├── env.ts             # Tipado y validación de variables de entorno
│   │   ├── errors.ts          # Clase HttpError (statusCode + code + message)
│   │   ├── audit/
│   │   │   └── auditLog.ts    # Helper writeAuditLog() — usar para ops críticas
│   │   ├── auth/
│   │   │   ├── jwtPayload.ts  # buildAccessPayload, permisosFromRolJson
│   │   │   ├── jwtTypes.ts    # Tipo JwtAccessPayload
│   │   │   ├── permissions.ts # hasPermission(permisos, recurso, accion)
│   │   │   ├── requireAuth.ts # Hook Fastify: valida JWT, popula request.user
│   │   │   └── requirePermission.ts # Hook factory: RBAC sobre claims del token
│   │   ├── http/
│   │   │   └── response.ts    # sendOk(), sendFail(), tipos ApiSuccess / ApiFailure
│   │   └── plugins/
│   │       ├── auditAccess.ts  # Hook onResponse: log estructurado de accesos HTTP
│   │       ├── errorHandler.ts # Error handler global de Fastify
│   │       ├── openapi.ts      # Registro de Swagger + Scalar docs
│   │       └── requestContext.ts # Inyecta requestId en cada request
│   ├── modules/               # Módulos de dominio (ver sección siguiente)
│   └── types/
│       ├── fastify.d.ts       # Augmentación: request.requestId, request.user
│       └── jwt.d.ts           # Augmentación: tipos del payload JWT
```

### Módulos disponibles

| Módulo | Prefijo de ruta | Descripción |
|---|---|---|
| `auth` | `/api/auth` | Login, logout, refresh, me |
| `organizaciones` | `/api/organizaciones` | CRUD de organizaciones (tenants) |
| `roles` | `/api` | Roles y sus permisos por organización |
| `sedes` | `/api` | Sedes y consultorios |
| `usuarios` | `/api` | Usuarios del tenant |
| `disponibilidad` | `/api/disponibilidad` | Reglas de disponibilidad y calendario |
| `audit-log` | `/api` | Consulta del log de auditoría |

### Estructura interna de cada módulo

```
modules/<nombre>/
  <nombre>.routes.ts      # Plugin Fastify: registra rutas con sus schemas
  <nombre>.controller.ts  # Parsea request → llama service → envía response
  <nombre>.service.ts     # Lógica de negocio + queries Prisma
  <nombre>.schemas.ts     # Tipos TS + JSON Schema (validación + OpenAPI)
```

---

## Arquitectura y patrones clave

### Multi-tenancy

**Toda** consulta a la BD debe estar filtrada por `organizacion_id`. El tenant se extrae del JWT (`request.user.organizacion_id`). Nunca omitir este filtro.

### Soft deletes

Prácticamente todas las tablas tienen `deleted: Boolean` y `deleted_at`. Siempre filtrar `deleted: false` en las consultas. Para eliminar: actualizar `deleted: true, deleted_at: new Date()`.

### Formato de respuesta unificado

Todas las respuestas usan los helpers de `src/core/http/response.ts`:

```ts
// Éxito
sendOk(reply, request.requestId, data, statusCode?)
// → { success: true, data, meta: { requestId } }

// Error
sendFail(reply, request.requestId, statusCode, 'ERROR_CODE', 'mensaje', details?)
// → { success: false, error: { code, message, details? }, meta: { requestId } }
```

### Manejo de errores

Lanzar `HttpError` desde cualquier capa (service, controller):

```ts
import { HttpError } from '../../core/errors.js';

throw new HttpError(404, 'NOT_FOUND', 'Recurso no encontrado.');
throw new HttpError(409, 'CONFLICT', 'Ya existe un registro con ese valor.');
throw new HttpError(400, 'VALIDATION_ERROR', 'Dato inválido.');
```

El `errorHandler` global lo convierte automáticamente al formato estándar.

### Autenticación y autorización

```ts
import { requireAuth } from '../../core/auth/requireAuth.js';
import { requirePermission } from '../../core/auth/requirePermission.js';

// En routes.ts — siempre como array en preHandler:
app.get('/ruta', {
  ...miSchema,
  preHandler: [requireAuth, requirePermission('modulo', 'accion')],
}, controller.handler);
```

`request.user` disponible tras `requireAuth`:
```ts
request.user.sub             // usuario_id (UUID)
request.user.organizacion_id // tenant
request.user.rol_id
request.user.permisos        // Record<string, unknown>
```

### Permisos (RBAC)

Los permisos se almacenan como JSON en `rol.permisos`. Formato válido:
```json
{
  "usuarios": "*",
  "agenda": ["leer", "crear", "editar"],
  "reportes": true
}
```

Donde `"*"` o `true` = acceso total al módulo, o un array de acciones específicas.

**Plantillas de roles predefinidas:** `admin`, `medico`, `secretaria`, `enfermeria` (ver `src/modules/roles/role.templates.ts`).

### Auditoría transversal (OBLIGATORIA en operaciones críticas)

Para cualquier operación que cree, modifique o elimine datos sensibles, usar el helper existente. **No duplicar código.**

```ts
import { writeAuditLog } from '../../core/audit/auditLog.ts';

await writeAuditLog({
  request,                     // FastifyRequest (aporta IP, user-agent, user.sub)
  organizacionId,              // string — ID del tenant
  accion: 'crear',             // verbo corto: crear | actualizar | eliminar | login | etc.
  recurso: 'pacientes',        // nombre del módulo/tabla
  recursoId: nuevoRegistro.id, // opcional — ID del recurso afectado
  descripcion: 'Paciente creado por el usuario.',
  datosAntes: undefined,       // snapshot previo para updates/deletes
  datosDespues: nuevoRegistro, // snapshot posterior para creates/updates
});
```

El helper:
- Nunca lanza excepción si el valor no es serializable (lo convierte de forma segura).
- Registra automáticamente `usuario_id`, `ip`, `user_agent` y `fecha`.
- Escribe en la tabla `audit_log` de la BD.

### Transacciones Prisma

Para operaciones que tocan múltiples tablas, usar `prisma.$transaction`:

```ts
await prisma.$transaction(async (tx) => {
  await tx.tabla1.update(...);
  await tx.tabla2.create(...);
});

// O batch (sin callback):
await prisma.$transaction([
  prisma.tabla1.update(...),
  prisma.tabla2.updateMany(...),
]);
```

---

## Autenticación (flujo completo)

```
POST /api/auth/login        → { token, accessToken, refreshToken, expiresIn, usuario }
POST /api/auth/refresh      → { token, accessToken, refreshToken } (rota el refresh token)
POST /api/auth/logout       → revoca el refresh token
GET  /api/auth/me           → datos del usuario autenticado
```

El access token (JWT) dura `JWT_ACCESS_EXPIRES_IN` (default 15m). El refresh token es opaco, se guarda hasheado en BD, y se rota en cada uso.

---

## Endpoints disponibles (resumen)

```
GET    /api/health

# Auth
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
GET    /api/auth/me

# Organizaciones
GET    /api/organizaciones
GET    /api/organizaciones/search
GET    /api/organizaciones/:id
POST   /api/organizaciones
PATCH  /api/organizaciones/:id
DELETE /api/organizaciones/:id

# Roles
GET    /api/roles
GET    /api/roles/search
GET    /api/roles/templates
GET    /api/roles/templates/:key
GET    /api/roles/:id
POST   /api/roles
PATCH  /api/roles/:id
DELETE /api/roles/:id

# Sedes y Consultorios
GET    /api/sedes
GET    /api/sedes/search
GET    /api/sedes/:id
POST   /api/sedes
PATCH  /api/sedes/:id
DELETE /api/sedes/:id
GET    /api/sedes/:sedeId/consultorios
POST   /api/sedes/:sedeId/consultorios
GET    /api/consultorios/search
GET    /api/consultorios/:id
PATCH  /api/consultorios/:id
DELETE /api/consultorios/:id

# Usuarios
GET    /api/usuarios
GET    /api/usuarios/search
GET    /api/usuarios/:id
POST   /api/usuarios
PATCH  /api/usuarios/:id
PATCH  /api/usuarios/:id/desactivar
DELETE /api/usuarios/:id

# Disponibilidad
GET    /api/disponibilidad/reglas/search
GET    /api/disponibilidad/reglas/:id
GET    /api/disponibilidad/reglas/usuario/:usuarioId
POST   /api/disponibilidad/reglas
PATCH  /api/disponibilidad/reglas/:id
DELETE /api/disponibilidad/reglas/:id
GET    /api/disponibilidad/calendario

# Audit Log
GET    /api/audit-log
GET    /api/audit-log/search
GET    /api/audit-log/:id
```

---

## Convención de commits

```
[UC-CORE-001] feat: descripción
[UC-AGE-001]  fix: descripción
[UC-FACT-002] refactor: descripción
```

---

## Documentación interactiva

Con el servidor corriendo, abrir en el navegador:

```
http://localhost:3000/docs
```

Incluye Swagger UI (Scalar) con todos los endpoints documentados y posibilidad de probarlos directamente.
