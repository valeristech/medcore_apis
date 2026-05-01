export type SearchAuditLogsQuery = {
  organizacion_id?: string;
  usuario_id?: string;
  accion?: string;
  recurso?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'fecha' | 'accion' | 'recurso' | 'created_at';
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

const auditShape = {
  type: 'object',
  required: ['id', 'organizacion_id', 'accion', 'recurso', 'fecha'],
  properties: {
    id: { type: 'string' },
    organizacion_id: { type: 'string' },
    usuario_id: { type: 'string', nullable: true },
    accion: { type: 'string' },
    recurso: { type: 'string' },
    recurso_id: { type: 'string', nullable: true },
    descripcion: { type: 'string', nullable: true },
    datos_antes: {},
    datos_despues: {},
    ip: { type: 'string', nullable: true },
    user_agent: { type: 'string', nullable: true },
    fecha: { type: 'string', format: 'date-time' },
  },
} as const;

const idParam = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string' } },
} as const;

export const listAuditLogsSchema = {
  schema: {
    tags: ['Core / Auditoría'],
    summary: 'Listar eventos de auditoría del tenant',
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
            properties: { items: { type: 'array', items: auditShape } },
          },
          meta: envelopeMeta,
        },
      },
      401: errorEnvelope,
      403: errorEnvelope,
    },
  },
} as const;

export const getAuditLogSchema = {
  schema: {
    tags: ['Core / Auditoría'],
    summary: 'Obtener evento de auditoría por ID',
    security: [{ bearerAuth: [] }],
    params: idParam,
    response: {
      200: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { type: 'object', required: ['auditLog'], properties: { auditLog: auditShape } },
          meta: envelopeMeta,
        },
      },
      401: errorEnvelope,
      403: errorEnvelope,
      404: errorEnvelope,
    },
  },
} as const;

export const searchAuditLogsSchema = {
  schema: {
    tags: ['Core / Auditoría'],
    summary: 'Buscar audit logs (scope tenant)',
    description:
      'Filtros: organizacion_id, usuario_id, accion, recurso. Paginación: page (default 1), pageSize (default 20, max 100). Orden: sortBy (fecha|accion|recurso|created_at) y sortOrder (asc|desc, default desc).',
    security: [{ bearerAuth: [] }],
    querystring: {
      type: 'object',
      additionalProperties: false,
      properties: {
        organizacion_id: {
          type: 'string',
          minLength: 1,
          description: 'Filtro por organización (en scope tenant debe coincidir con el JWT).',
        },
        usuario_id: { type: 'string', minLength: 1, description: 'Filtro por usuario que ejecutó la acción.' },
        accion: { type: 'string', minLength: 1, description: 'Filtro por acción (create, update, delete, disable, login, ...).' },
        recurso: { type: 'string', minLength: 1, description: 'Filtro por recurso (organizacion, sede, consultorio, rol, usuario, auth).' },
        page: { type: 'integer', minimum: 1, default: 1 },
        pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        sortBy: { type: 'string', enum: ['fecha', 'accion', 'recurso', 'created_at'], default: 'fecha' },
        sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
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
              items: { type: 'array', items: auditShape },
              pagination: {
                type: 'object',
                required: ['page', 'pageSize', 'total', 'totalPages'],
                properties: {
                  page: { type: 'integer' },
                  pageSize: { type: 'integer' },
                  total: { type: 'integer' },
                  totalPages: { type: 'integer' },
                },
              },
              sort: {
                type: 'object',
                required: ['sortBy', 'sortOrder'],
                properties: {
                  sortBy: { type: 'string' },
                  sortOrder: { type: 'string', enum: ['asc', 'desc'] },
                },
              },
              filters: {
                type: 'object',
                properties: {
                  organizacion_id: { type: 'string' },
                  usuario_id: { type: 'string' },
                  accion: { type: 'string' },
                  recurso: { type: 'string' },
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
