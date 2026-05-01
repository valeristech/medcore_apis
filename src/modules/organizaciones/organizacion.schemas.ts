export type CreateOrganizacionInput = {
  razon_social: string;
  nit: string;
  direccion?: string;
  logo_url?: string;
  moneda?: string;
  zona_horaria?: string;
  idioma?: string;
  certificador_fel?: string;
  certificado_fel?: string;
  serie_fel?: string;
  correlativo_fel?: number;
  activo?: boolean;
};

export type UpdateOrganizacionInput = Partial<CreateOrganizacionInput>;
export type SearchOrganizacionesQuery = {
  razon_social?: string;
  nit?: string;
  direccion?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'razon_social' | 'nit' | 'direccion' | 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
};

const envelopeMeta = {
  type: 'object',
  required: ['requestId'],
  properties: {
    requestId: { type: 'string' },
  },
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

const organizacionShape = {
  type: 'object',
  required: ['id', 'razon_social', 'nit'],
  properties: {
    id: { type: 'string' },
    razon_social: { type: 'string' },
    nit: { type: 'string' },
    direccion: { type: 'string', nullable: true },
    logo_url: { type: 'string', nullable: true },
    moneda: { type: 'string', nullable: true },
    zona_horaria: { type: 'string', nullable: true },
    idioma: { type: 'string', nullable: true },
    certificador_fel: { type: 'string', nullable: true },
    certificado_fel: { type: 'string', nullable: true },
    serie_fel: { type: 'string', nullable: true },
    correlativo_fel: { type: 'number', nullable: true },
    activo: { type: 'boolean', nullable: true },
    created_at: { type: 'string', format: 'date-time', nullable: true },
    updated_at: { type: 'string', format: 'date-time', nullable: true },
  },
} as const;

const idParamSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string' },
  },
} as const;

export const listOrganizacionesSchema = {
  schema: {
    tags: ['Core / Organizaciones'],
    summary: 'Listar organizaciones (scope tenant)',
    description:
      'Devuelve organizaciones visibles para el tenant autenticado. En el estado actual, retorna su propia organización.',
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
              items: {
                type: 'array',
                items: organizacionShape,
              },
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

export const searchOrganizacionesSchema = {
  schema: {
    tags: ['Core / Organizaciones'],
    summary: 'Buscar organizaciones (scope tenant)',
    description:
      'Respeta el tenant del JWT (organizacion_id). Filtros: razon_social, nit, direccion. Paginación: page (default 1), pageSize (default 20, max 100). Ordenamiento: sortBy (razon_social|nit|direccion|created_at|updated_at) y sortOrder (asc|desc, default desc).',
    security: [{ bearerAuth: [] }],
    querystring: {
      type: 'object',
      additionalProperties: false,
      properties: {
        razon_social: {
          type: 'string',
          minLength: 1,
          maxLength: 200,
          description: 'Filtro por razón social (contains, case-insensitive).',
        },
        nit: { type: 'string', minLength: 1, maxLength: 20, description: 'Filtro por NIT (contains, case-insensitive).' },
        direccion: { type: 'string', minLength: 1, description: 'Filtro por dirección (contains, case-insensitive).' },
        page: { type: 'integer', minimum: 1, default: 1, description: 'Número de página (base 1).' },
        pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20, description: 'Tamaño de página (máximo 100).' },
        sortBy: {
          type: 'string',
          enum: ['razon_social', 'nit', 'direccion', 'created_at', 'updated_at'],
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
              items: {
                type: 'array',
                items: organizacionShape,
              },
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
                  razon_social: { type: 'string' },
                  nit: { type: 'string' },
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

export const getOrganizacionSchema = {
  schema: {
    tags: ['Core / Organizaciones'],
    summary: 'Obtener organización por ID',
    security: [{ bearerAuth: [] }],
    params: idParamSchema,
    response: {
      200: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'object',
            required: ['organizacion'],
            properties: {
              organizacion: organizacionShape,
            },
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

export const createOrganizacionSchema = {
  schema: {
    tags: ['Core / Organizaciones'],
    summary: 'Crear organización',
    description: 'Crea una organización con NIT único y configuración FEL opcional.',
    security: [{ bearerAuth: [] }],
    body: {
      type: 'object',
      required: ['razon_social', 'nit'],
      properties: {
        razon_social: { type: 'string', minLength: 2, maxLength: 200 },
        nit: { type: 'string', minLength: 3, maxLength: 20 },
        direccion: { type: 'string' },
        logo_url: { type: 'string', maxLength: 500 },
        moneda: { type: 'string', maxLength: 10 },
        zona_horaria: { type: 'string', maxLength: 50 },
        idioma: { type: 'string', maxLength: 10 },
        certificador_fel: { type: 'string', maxLength: 100 },
        certificado_fel: { type: 'string' },
        serie_fel: { type: 'string', maxLength: 20 },
        correlativo_fel: { type: 'integer', minimum: 0 },
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
            required: ['organizacion'],
            properties: {
              organizacion: organizacionShape,
            },
          },
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

export const updateOrganizacionSchema = {
  schema: {
    tags: ['Core / Organizaciones'],
    summary: 'Actualizar organización',
    security: [{ bearerAuth: [] }],
    params: idParamSchema,
    body: {
      type: 'object',
      additionalProperties: false,
      properties: {
        razon_social: { type: 'string', minLength: 2, maxLength: 200 },
        nit: { type: 'string', minLength: 3, maxLength: 20 },
        direccion: { type: 'string' },
        logo_url: { type: 'string', maxLength: 500 },
        moneda: { type: 'string', maxLength: 10 },
        zona_horaria: { type: 'string', maxLength: 50 },
        idioma: { type: 'string', maxLength: 10 },
        certificador_fel: { type: 'string', maxLength: 100 },
        certificado_fel: { type: 'string' },
        serie_fel: { type: 'string', maxLength: 20 },
        correlativo_fel: { type: 'integer', minimum: 0 },
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
            required: ['organizacion'],
            properties: {
              organizacion: organizacionShape,
            },
          },
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

export const deleteOrganizacionSchema = {
  schema: {
    tags: ['Core / Organizaciones'],
    summary: 'Eliminar organización (soft delete)',
    security: [{ bearerAuth: [] }],
    params: idParamSchema,
    response: {
      200: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'object',
            required: ['ok'],
            properties: {
              ok: { type: 'boolean', enum: [true] },
            },
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
