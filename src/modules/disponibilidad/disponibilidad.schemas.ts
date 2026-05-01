export type FranjaInput = {
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
};

export type ExcepcionInput = {
  fecha: string;
  cerrado?: boolean;
  franjas?: FranjaInput[];
};

export type CreateReglaDisponibilidadInput = {
  usuario_id: string;
  consultorio_id: string;
  franjas: FranjaInput[];
  excepciones?: ExcepcionInput[];
  vigencia_inicio?: string | null;
  vigencia_fin?: string | null;
};

export type UpdateReglaDisponibilidadInput = Partial<
  Omit<CreateReglaDisponibilidadInput, 'usuario_id' | 'consultorio_id'>
> & {
  usuario_id?: string;
  consultorio_id?: string;
};

export type SearchReglasQuery = {
  usuario_id?: string;
  consultorio_id?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'created_at' | 'vigencia_inicio';
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

const franjaShape = {
  type: 'object',
  required: ['dia_semana', 'hora_inicio', 'hora_fin'],
  properties: {
    dia_semana: {
      type: 'integer',
      minimum: 0,
      maximum: 6,
      description: '0=domingo … 6=sábado (convención Date.getDay()).',
    },
    hora_inicio: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' },
    hora_fin: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' },
  },
} as const;

const excepcionShape = {
  type: 'object',
  required: ['fecha'],
  properties: {
    fecha: { type: 'string', format: 'date' },
    cerrado: { type: 'boolean' },
    franjas: { type: 'array', items: franjaShape },
  },
} as const;

const reglaShape = {
  type: 'object',
  required: ['id', 'usuario_id', 'consultorio_id', 'franjas'],
  properties: {
    id: { type: 'string' },
    usuario_id: { type: 'string' },
    consultorio_id: { type: 'string' },
    franjas: { type: 'array', items: franjaShape },
    excepciones: { type: 'array', items: excepcionShape },
    vigencia_inicio: { type: 'string', format: 'date', nullable: true },
    vigencia_fin: { type: 'string', format: 'date', nullable: true },
    created_at: { type: 'string', format: 'date-time', nullable: true },
    usuario: {
      type: 'object',
      nullable: true,
      properties: {
        id: { type: 'string' },
        nombre: { type: 'string' },
        apellido: { type: 'string' },
        email: { type: 'string' },
      },
    },
    consultorio: {
      type: 'object',
      nullable: true,
      properties: {
        id: { type: 'string' },
        nombre: { type: 'string' },
        sede_id: { type: 'string' },
        activo: { type: 'boolean', nullable: true },
      },
    },
  },
} as const;

const reglaIdParam = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string' } },
} as const;

const usuarioIdParam = {
  type: 'object',
  required: ['usuarioId'],
  properties: { usuarioId: { type: 'string' } },
} as const;

export const searchReglasSchema = {
  schema: {
    tags: ['Agenda / Disponibilidad'],
    summary: 'Buscar reglas de disponibilidad (tenant)',
    description:
      'Filtros opcionales por médico (`usuario_id`) y consultorio. Paginación y orden por `created_at` o `vigencia_inicio`.',
    security: [{ bearerAuth: [] }],
    querystring: {
      type: 'object',
      additionalProperties: false,
      properties: {
        usuario_id: { type: 'string', description: 'UUID del usuario (médico) en el tenant.' },
        consultorio_id: { type: 'string', description: 'UUID del consultorio en el tenant.' },
        page: { type: 'integer', minimum: 1, default: 1 },
        pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        sortBy: {
          type: 'string',
          enum: ['created_at', 'vigencia_inicio'],
          default: 'created_at',
        },
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
              items: { type: 'array', items: reglaShape },
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
                  usuario_id: { type: 'string' },
                  consultorio_id: { type: 'string' },
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

export const listReglasByUsuarioSchema = {
  schema: {
    tags: ['Agenda / Disponibilidad'],
    summary: 'Listar reglas de un médico (usuario)',
    security: [{ bearerAuth: [] }],
    params: usuarioIdParam,
    response: {
      200: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'object',
            required: ['items'],
            properties: { items: { type: 'array', items: reglaShape } },
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

export const getReglaSchema = {
  schema: {
    tags: ['Agenda / Disponibilidad'],
    summary: 'Obtener regla por ID',
    security: [{ bearerAuth: [] }],
    params: reglaIdParam,
    response: {
      200: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { type: 'object', required: ['regla'], properties: { regla: reglaShape } },
          meta: envelopeMeta,
        },
      },
      401: errorEnvelope,
      403: errorEnvelope,
      404: errorEnvelope,
    },
  },
} as const;

export const createReglaSchema = {
  schema: {
    tags: ['Agenda / Disponibilidad'],
    summary: 'Crear regla de disponibilidad',
    description:
      '`franjas`: bloques recurrentes por día (0=dom…6=sáb) con `hora_inicio`/`hora_fin` en HH:mm. `excepciones`: fechas con cierre total o `franjas` sustitutas. Vigencias opcionales en ISO date (YYYY-MM-DD).',
    security: [{ bearerAuth: [] }],
    body: {
      type: 'object',
      required: ['usuario_id', 'consultorio_id', 'franjas'],
      additionalProperties: false,
      properties: {
        usuario_id: { type: 'string' },
        consultorio_id: { type: 'string' },
        franjas: { type: 'array', minItems: 1, items: franjaShape },
        excepciones: { type: 'array', items: excepcionShape },
        vigencia_inicio: { type: 'string', format: 'date' },
        vigencia_fin: { type: 'string', format: 'date' },
      },
    },
    response: {
      201: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { type: 'object', required: ['regla'], properties: { regla: reglaShape } },
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

export const updateReglaSchema = {
  schema: {
    tags: ['Agenda / Disponibilidad'],
    summary: 'Actualizar regla de disponibilidad',
    security: [{ bearerAuth: [] }],
    params: reglaIdParam,
    body: {
      type: 'object',
      additionalProperties: false,
      properties: {
        usuario_id: { type: 'string' },
        consultorio_id: { type: 'string' },
        franjas: { type: 'array', minItems: 1, items: franjaShape },
        excepciones: { type: 'array', items: excepcionShape },
        vigencia_inicio: { type: 'string', format: 'date', nullable: true },
        vigencia_fin: { type: 'string', format: 'date', nullable: true },
      },
    },
    response: {
      200: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { type: 'object', required: ['regla'], properties: { regla: reglaShape } },
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

export const deleteReglaSchema = {
  schema: {
    tags: ['Agenda / Disponibilidad'],
    summary: 'Eliminar regla (soft delete)',
    security: [{ bearerAuth: [] }],
    params: reglaIdParam,
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
