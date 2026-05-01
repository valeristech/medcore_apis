import type { RoleTemplateKey } from './role.templates.js';

export type CreateRoleInput = {
  nombre: string;
  descripcion?: string;
  permisos?: unknown;
  plantilla?: RoleTemplateKey;
};

export type UpdateRoleInput = Partial<CreateRoleInput>;
export type SearchRolesQuery = {
  nombre?: string;
  descripcion?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'nombre' | 'descripcion' | 'created_at';
  sortOrder?: 'asc' | 'desc';
};

const envelopeMeta = {
  type: 'object',
  required: ['requestId'],
  properties: { requestId: { type: 'string' } },
} as const;

const errorEnvelope = {
  type: 'object',
  required: ['success', 'error', 'meta'],
  properties: {
    success: { type: 'boolean', enum: [false] },
    error: {
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        details: {},
      },
    },
    meta: envelopeMeta,
  },
} as const;

const roleShape = {
  type: 'object',
  required: ['id', 'organizacion_id', 'nombre', 'permisos'],
  properties: {
    id: { type: 'string' },
    organizacion_id: { type: 'string' },
    nombre: { type: 'string' },
    descripcion: { type: 'string', nullable: true },
    permisos: { type: 'object', additionalProperties: true },
    created_at: { type: 'string', format: 'date-time', nullable: true },
  },
} as const;

const templateShape = {
  type: 'object',
  required: ['key', 'nombre', 'descripcion', 'permisos'],
  properties: {
    key: { type: 'string', enum: ['admin', 'medico', 'secretaria', 'enfermeria'] },
    nombre: { type: 'string' },
    descripcion: { type: 'string' },
    permisos: { type: 'object', additionalProperties: true },
  },
} as const;

const roleIdParam = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string' } },
} as const;

const templateParam = {
  type: 'object',
  required: ['key'],
  properties: { key: { type: 'string', enum: ['admin', 'medico', 'secretaria', 'enfermeria'] } },
} as const;

export const listRolesSchema = {
  schema: {
    tags: ['Core / Roles y Permisos'],
    summary: 'Listar roles del tenant',
    security: [{ bearerAuth: [] }],
    response: {
      200: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'object',
            required: ['items'],
            properties: { items: { type: 'array', items: roleShape } },
          },
          meta: envelopeMeta,
        },
      },
      401: errorEnvelope,
      403: errorEnvelope,
    },
  },
} as const;

export const searchRolesSchema = {
  schema: {
    tags: ['Core / Roles y Permisos'],
    summary: 'Buscar roles (scope tenant)',
    description:
      'Filtros: nombre y descripcion. Paginación: page (default 1), pageSize (default 20, max 100). Orden: sortBy (nombre|descripcion|created_at) y sortOrder (asc|desc, default desc).',
    security: [{ bearerAuth: [] }],
    querystring: {
      type: 'object',
      additionalProperties: false,
      properties: {
        nombre: {
          type: 'string',
          minLength: 1,
          maxLength: 80,
          description: 'Filtro por nombre (contains, case-insensitive).',
        },
        descripcion: {
          type: 'string',
          minLength: 1,
          description: 'Filtro por descripción (contains, case-insensitive).',
        },
        page: { type: 'integer', minimum: 1, default: 1, description: 'Número de página (base 1).' },
        pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20, description: 'Tamaño de página (máximo 100).' },
        sortBy: {
          type: 'string',
          enum: ['nombre', 'descripcion', 'created_at'],
          default: 'created_at',
          description: 'Campo por el cual ordenar.',
        },
        sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc', description: 'Dirección del ordenamiento.' },
      },
    },
    response: {
      200: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'object',
            required: ['items', 'pagination', 'sort'],
            properties: {
              items: { type: 'array', items: roleShape },
              pagination: {
                type: 'object',
                required: ['page', 'pageSize', 'total', 'totalPages'],
                properties: {
                  page: { type: 'integer' },
                  pageSize: { type: 'integer', description: 'Cantidad de registros por página.' },
                  total: { type: 'integer', description: 'Total de registros que cumplen filtros.' },
                  totalPages: { type: 'integer', description: 'Total de páginas disponibles.' },
                },
              },
              sort: {
                type: 'object',
                required: ['sortBy', 'sortOrder'],
                properties: {
                  sortBy: { type: 'string', description: 'Campo utilizado para ordenar.' },
                  sortOrder: { type: 'string', enum: ['asc', 'desc'], description: 'Dirección aplicada en el orden.' },
                },
              },
              filters: {
                type: 'object',
                description: 'Echo de filtros aplicados en la consulta.',
                properties: {
                  nombre: { type: 'string' },
                  descripcion: { type: 'string' },
                },
              },
            },
          },
          meta: envelopeMeta,
        },
      },
      400: errorEnvelope,
      401: errorEnvelope,
      403: errorEnvelope,
    },
  },
} as const;

export const getRoleSchema = {
  schema: {
    tags: ['Core / Roles y Permisos'],
    summary: 'Obtener rol por ID',
    security: [{ bearerAuth: [] }],
    params: roleIdParam,
    response: {
      200: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { type: 'object', required: ['rol'], properties: { rol: roleShape } },
          meta: envelopeMeta,
        },
      },
      401: errorEnvelope,
      403: errorEnvelope,
      404: errorEnvelope,
    },
  },
} as const;

export const createRoleSchema = {
  schema: {
    tags: ['Core / Roles y Permisos'],
    summary: 'Crear rol',
    description:
      'Crea rol con permisos JSON válidos o a partir de plantilla clínica (`admin|medico|secretaria|enfermeria`).',
    security: [{ bearerAuth: [] }],
    body: {
      type: 'object',
      required: ['nombre'],
      properties: {
        nombre: { type: 'string', minLength: 2, maxLength: 80 },
        descripcion: { type: 'string' },
        permisos: { type: 'object', additionalProperties: true },
        plantilla: { type: 'string', enum: ['admin', 'medico', 'secretaria', 'enfermeria'] },
      },
    },
    response: {
      201: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { type: 'object', required: ['rol'], properties: { rol: roleShape } },
          meta: envelopeMeta,
        },
      },
      400: errorEnvelope,
      401: errorEnvelope,
      403: errorEnvelope,
      409: errorEnvelope,
    },
  },
} as const;

export const updateRoleSchema = {
  schema: {
    tags: ['Core / Roles y Permisos'],
    summary: 'Actualizar rol',
    security: [{ bearerAuth: [] }],
    params: roleIdParam,
    body: {
      type: 'object',
      additionalProperties: false,
      properties: {
        nombre: { type: 'string', minLength: 2, maxLength: 80 },
        descripcion: { type: 'string' },
        permisos: { type: 'object', additionalProperties: true },
        plantilla: { type: 'string', enum: ['admin', 'medico', 'secretaria', 'enfermeria'] },
      },
    },
    response: {
      200: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { type: 'object', required: ['rol'], properties: { rol: roleShape } },
          meta: envelopeMeta,
        },
      },
      400: errorEnvelope,
      401: errorEnvelope,
      403: errorEnvelope,
      404: errorEnvelope,
      409: errorEnvelope,
    },
  },
} as const;

export const deleteRoleSchema = {
  schema: {
    tags: ['Core / Roles y Permisos'],
    summary: 'Eliminar rol (soft delete)',
    security: [{ bearerAuth: [] }],
    params: roleIdParam,
    response: {
      200: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' } } },
          meta: envelopeMeta,
        },
      },
      401: errorEnvelope,
      403: errorEnvelope,
      404: errorEnvelope,
      409: errorEnvelope,
    },
  },
} as const;

export const listRoleTemplatesSchema = {
  schema: {
    tags: ['Core / Roles y Permisos'],
    summary: 'Listar plantillas de rol clínico',
    security: [{ bearerAuth: [] }],
    response: {
      200: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'object',
            required: ['items'],
            properties: { items: { type: 'array', items: templateShape } },
          },
          meta: envelopeMeta,
        },
      },
      401: errorEnvelope,
      403: errorEnvelope,
    },
  },
} as const;

export const getRoleTemplateSchema = {
  schema: {
    tags: ['Core / Roles y Permisos'],
    summary: 'Obtener plantilla por key',
    security: [{ bearerAuth: [] }],
    params: templateParam,
    response: {
      200: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { type: 'object', required: ['template'], properties: { template: templateShape } },
          meta: envelopeMeta,
        },
      },
      401: errorEnvelope,
      403: errorEnvelope,
      404: errorEnvelope,
    },
  },
} as const;
