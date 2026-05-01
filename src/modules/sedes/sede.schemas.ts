export type CreateSedeInput = {
  nombre: string;
  direccion?: string;
  telefono?: string;
  horarios?: unknown;
  activo?: boolean;
};

export type UpdateSedeInput = Partial<CreateSedeInput>;

export type CreateConsultorioInput = {
  nombre: string;
  tipo: 'consulta' | 'procedimiento' | 'telemedicina';
  activo?: boolean;
};

export type UpdateConsultorioInput = Partial<CreateConsultorioInput>;
export type SearchSedesQuery = {
  organizacion_id?: string;
  nombre?: string;
  direccion?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'organizacion_id' | 'nombre' | 'direccion' | 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
};

export type SearchConsultoriosQuery = {
  sede_id?: string;
  nombre?: string;
  tipo?: 'consulta' | 'procedimiento' | 'telemedicina';
  page?: number;
  pageSize?: number;
  sortBy?: 'sede_id' | 'nombre' | 'tipo' | 'created_at';
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

const consultorioShape = {
  type: 'object',
  required: ['id', 'sede_id', 'nombre', 'tipo'],
  properties: {
    id: { type: 'string' },
    sede_id: { type: 'string' },
    nombre: { type: 'string' },
    tipo: { type: 'string' },
    activo: { type: 'boolean', nullable: true },
    created_at: { type: 'string', format: 'date-time', nullable: true },
  },
} as const;

const sedeShape = {
  type: 'object',
  required: ['id', 'organizacion_id', 'nombre'],
  properties: {
    id: { type: 'string' },
    organizacion_id: { type: 'string' },
    nombre: { type: 'string' },
    direccion: { type: 'string', nullable: true },
    telefono: { type: 'string', nullable: true },
    horarios: {},
    activo: { type: 'boolean', nullable: true },
    created_at: { type: 'string', format: 'date-time', nullable: true },
    updated_at: { type: 'string', format: 'date-time', nullable: true },
    consultorios: { type: 'array', items: consultorioShape },
  },
} as const;

const sedeIdParam = {
  type: 'object',
  required: ['sedeId'],
  properties: { sedeId: { type: 'string' } },
} as const;

const sedeConsultorioIdParam = {
  type: 'object',
  required: ['sedeId', 'id'],
  properties: { sedeId: { type: 'string' }, id: { type: 'string' } },
} as const;

const consultorioIdParam = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string' } },
} as const;

export const listSedesSchema = {
  schema: {
    tags: ['Core / Sedes'],
    summary: 'Listar sedes con jerarquía de consultorios',
    description:
      'Devuelve sedes de la organización del JWT, incluyendo consultorios activos (soft delete excluido).',
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
            properties: {
              items: { type: 'array', items: sedeShape },
            },
          },
          meta: envelopeMeta,
        },
      },
      401: errorEnvelope,
      403: errorEnvelope,
    },
  },
} as const;

export const searchSedesSchema = {
  schema: {
    tags: ['Core / Sedes'],
    summary: 'Buscar sedes (scope tenant)',
    description:
      'Respeta tenant del JWT. Filtros: organizacion_id, nombre, direccion. Paginación: page (default 1), pageSize (default 20, max 100). Orden: sortBy (organizacion_id|nombre|direccion|created_at|updated_at) y sortOrder (asc|desc, default desc).',
    security: [{ bearerAuth: [] }],
    querystring: {
      type: 'object',
      additionalProperties: false,
      properties: {
        organizacion_id: {
          type: 'string',
          minLength: 1,
          description:
            'Filtro por organización. En scope tenant solo coincide con la organización del JWT.',
        },
        nombre: { type: 'string', minLength: 1, maxLength: 150, description: 'Filtro por nombre de sede (contains, case-insensitive).' },
        direccion: { type: 'string', minLength: 1, description: 'Filtro por dirección (contains, case-insensitive).' },
        page: { type: 'integer', minimum: 1, default: 1, description: 'Número de página (base 1).' },
        pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20, description: 'Tamaño de página (máximo 100).' },
        sortBy: {
          type: 'string',
          enum: ['organizacion_id', 'nombre', 'direccion', 'created_at', 'updated_at'],
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
              items: { type: 'array', items: sedeShape },
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
                  organizacion_id: { type: 'string' },
                  nombre: { type: 'string' },
                  direccion: { type: 'string' },
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

export const createSedeSchema = {
  schema: {
    tags: ['Core / Sedes'],
    summary: 'Crear sede',
    security: [{ bearerAuth: [] }],
    body: {
      type: 'object',
      required: ['nombre'],
      properties: {
        nombre: { type: 'string', minLength: 2, maxLength: 150 },
        direccion: { type: 'string' },
        telefono: { type: 'string', maxLength: 30 },
        horarios: {},
        activo: { type: 'boolean' },
      },
    },
    response: {
      201: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { type: 'object', required: ['sede'], properties: { sede: sedeShape } },
          meta: envelopeMeta,
        },
      },
      400: errorEnvelope,
      401: errorEnvelope,
      403: errorEnvelope,
    },
  },
} as const;

export const getSedeSchema = {
  schema: {
    tags: ['Core / Sedes'],
    summary: 'Obtener sede por ID',
    security: [{ bearerAuth: [] }],
    params: sedeIdParam,
    response: {
      200: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { type: 'object', required: ['sede'], properties: { sede: sedeShape } },
          meta: envelopeMeta,
        },
      },
      401: errorEnvelope,
      403: errorEnvelope,
      404: errorEnvelope,
    },
  },
} as const;

export const updateSedeSchema = {
  schema: {
    tags: ['Core / Sedes'],
    summary: 'Actualizar sede',
    security: [{ bearerAuth: [] }],
    params: sedeIdParam,
    body: {
      type: 'object',
      additionalProperties: false,
      properties: {
        nombre: { type: 'string', minLength: 2, maxLength: 150 },
        direccion: { type: 'string' },
        telefono: { type: 'string', maxLength: 30 },
        horarios: {},
        activo: { type: 'boolean' },
      },
    },
    response: {
      200: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { type: 'object', required: ['sede'], properties: { sede: sedeShape } },
          meta: envelopeMeta,
        },
      },
      400: errorEnvelope,
      401: errorEnvelope,
      403: errorEnvelope,
      404: errorEnvelope,
    },
  },
} as const;

export const deleteSedeSchema = {
  schema: {
    tags: ['Core / Sedes'],
    summary: 'Eliminar sede (soft delete)',
    security: [{ bearerAuth: [] }],
    params: sedeIdParam,
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
    },
  },
} as const;

export const listConsultoriosSchema = {
  schema: {
    tags: ['Core / Consultorios'],
    summary: 'Listar consultorios de una sede',
    description:
      'Lista consultorios de la sede indicada. Ruta: GET /api/consultorios/sedes/{sedeId}.',
    security: [{ bearerAuth: [] }],
    params: sedeIdParam,
    response: {
      200: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'object',
            required: ['items'],
            properties: { items: { type: 'array', items: consultorioShape } },
          },
          meta: envelopeMeta,
        },
      },
      401: errorEnvelope,
      403: errorEnvelope,
      404: errorEnvelope,
    },
  },
} as const;

export const searchConsultoriosSchema = {
  schema: {
    tags: ['Core / Consultorios'],
    summary: 'Buscar consultorios (scope tenant)',
    description:
      'Respeta tenant del JWT. Filtros: sede_id, nombre, tipo. Paginación: page (default 1), pageSize (default 20, max 100). Orden: sortBy (sede_id|nombre|tipo|created_at) y sortOrder (asc|desc, default desc).',
    security: [{ bearerAuth: [] }],
    querystring: {
      type: 'object',
      additionalProperties: false,
      properties: {
        sede_id: { type: 'string', minLength: 1, description: 'Filtro por sede_id (UUID exacto).' },
        nombre: {
          type: 'string',
          minLength: 1,
          maxLength: 100,
          description: 'Filtro por nombre (contains, case-insensitive).',
        },
        tipo: {
          type: 'string',
          enum: ['consulta', 'procedimiento', 'telemedicina'],
          description: 'Filtro exacto por tipo de consultorio.',
        },
        page: { type: 'integer', minimum: 1, default: 1, description: 'Número de página (base 1).' },
        pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20, description: 'Tamaño de página (máximo 100).' },
        sortBy: {
          type: 'string',
          enum: ['sede_id', 'nombre', 'tipo', 'created_at'],
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
              items: { type: 'array', items: consultorioShape },
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
                  sede_id: { type: 'string' },
                  nombre: { type: 'string' },
                  tipo: { type: 'string' },
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

export const createConsultorioSchema = {
  schema: {
    tags: ['Core / Consultorios'],
    summary: 'Crear consultorio en sede',
    description:
      'Crea consultorio asociado a la sede indicada. Ruta: POST /api/consultorios/sedes/{sedeId}.',
    security: [{ bearerAuth: [] }],
    params: sedeIdParam,
    body: {
      type: 'object',
      required: ['nombre', 'tipo'],
      properties: {
        nombre: { type: 'string', minLength: 2, maxLength: 100 },
        tipo: { type: 'string', enum: ['consulta', 'procedimiento', 'telemedicina'] },
        activo: { type: 'boolean' },
      },
    },
    response: {
      201: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'object',
            required: ['consultorio'],
            properties: { consultorio: consultorioShape },
          },
          meta: envelopeMeta,
        },
      },
      400: errorEnvelope,
      401: errorEnvelope,
      403: errorEnvelope,
      404: errorEnvelope,
    },
  },
} as const;

export const getConsultorioSchema = {
  schema: {
    tags: ['Core / Consultorios'],
    summary: 'Obtener consultorio por ID',
    description: 'Recupera consultorio por su ID, sin requerir sedeId. Respeta scope tenant del JWT.',
    security: [{ bearerAuth: [] }],
    params: consultorioIdParam,
    response: {
      200: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'object',
            required: ['consultorio'],
            properties: { consultorio: consultorioShape },
          },
          meta: envelopeMeta,
        },
      },
      401: errorEnvelope,
      403: errorEnvelope,
      404: errorEnvelope,
    },
  },
} as const;

export const updateConsultorioSchema = {
  schema: {
    tags: ['Core / Consultorios'],
    summary: 'Actualizar consultorio',
    security: [{ bearerAuth: [] }],
    params: consultorioIdParam,
    body: {
      type: 'object',
      additionalProperties: false,
      properties: {
        nombre: { type: 'string', minLength: 2, maxLength: 100 },
        tipo: { type: 'string', enum: ['consulta', 'procedimiento', 'telemedicina'] },
        activo: { type: 'boolean' },
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
            required: ['consultorio'],
            properties: { consultorio: consultorioShape },
          },
          meta: envelopeMeta,
        },
      },
      400: errorEnvelope,
      401: errorEnvelope,
      403: errorEnvelope,
      404: errorEnvelope,
    },
  },
} as const;

export const deleteConsultorioSchema = {
  schema: {
    tags: ['Core / Consultorios'],
    summary: 'Eliminar consultorio (soft delete)',
    security: [{ bearerAuth: [] }],
    params: consultorioIdParam,
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
    },
  },
} as const;
