export type UsuarioSedeInput = {
  sede_id: string;
  consultorio_id?: string;
};

export type CreateUsuarioInput = {
  rol_id: string;
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  especialidad?: string;
  numero_colegiado?: string;
  telefono?: string;
  estado?: 'activo' | 'inactivo' | 'suspendido';
  sedes?: UsuarioSedeInput[];
};

export type UpdateUsuarioInput = Partial<CreateUsuarioInput>;
export type SearchUsuariosQuery = {
  email?: string;
  nombre?: string;
  apellido?: string;
  especialidad?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'email' | 'nombre' | 'apellido' | 'especialidad' | 'created_at' | 'updated_at';
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

const usuarioSedeShape = {
  type: 'object',
  required: ['id', 'usuario_id', 'sede_id'],
  properties: {
    id: { type: 'string' },
    usuario_id: { type: 'string' },
    sede_id: { type: 'string' },
    consultorio_id: { type: 'string', nullable: true },
    created_at: { type: 'string', format: 'date-time', nullable: true },
  },
} as const;

const usuarioShape = {
  type: 'object',
  required: ['id', 'organizacion_id', 'rol_id', 'email', 'nombre', 'apellido'],
  properties: {
    id: { type: 'string' },
    organizacion_id: { type: 'string' },
    rol_id: { type: 'string' },
    email: { type: 'string' },
    nombre: { type: 'string' },
    apellido: { type: 'string' },
    especialidad: { type: 'string', nullable: true },
    numero_colegiado: { type: 'string', nullable: true },
    telefono: { type: 'string', nullable: true },
    estado: { type: 'string', nullable: true },
    ultimo_acceso: { type: 'string', format: 'date-time', nullable: true },
    created_at: { type: 'string', format: 'date-time', nullable: true },
    updated_at: { type: 'string', format: 'date-time', nullable: true },
    rol: { type: 'object', additionalProperties: true },
    usuario_sede: { type: 'array', items: usuarioSedeShape },
  },
} as const;

const idParam = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string' } },
} as const;

const usuarioSedeInputShape = {
  type: 'array',
  items: {
    type: 'object',
    required: ['sede_id'],
    properties: {
      sede_id: { type: 'string' },
      consultorio_id: { type: 'string' },
    },
  },
} as const;

export const listUsuariosSchema = {
  schema: {
    tags: ['Core / Usuarios'],
    summary: 'Listar usuarios del tenant',
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
            properties: { items: { type: 'array', items: usuarioShape } },
          },
          meta: envelopeMeta,
        },
      },
      401: errorEnvelope,
      403: errorEnvelope,
    },
  },
} as const;

export const searchUsuariosSchema = {
  schema: {
    tags: ['Core / Usuarios'],
    summary: 'Buscar usuarios (scope tenant)',
    description:
      'Filtros: email, nombre, apellido, especialidad. Paginación: page (default 1), pageSize (default 20, max 100). Orden: sortBy (email|nombre|apellido|especialidad|created_at|updated_at) y sortOrder (asc|desc, default desc).',
    security: [{ bearerAuth: [] }],
    querystring: {
      type: 'object',
      additionalProperties: false,
      properties: {
        email: {
          type: 'string',
          minLength: 1,
          maxLength: 200,
          description: 'Filtro por email (contains, case-insensitive).',
        },
        nombre: {
          type: 'string',
          minLength: 1,
          maxLength: 150,
          description: 'Filtro por nombre (contains, case-insensitive).',
        },
        apellido: {
          type: 'string',
          minLength: 1,
          maxLength: 150,
          description: 'Filtro por apellido (contains, case-insensitive).',
        },
        especialidad: {
          type: 'string',
          minLength: 1,
          maxLength: 100,
          description: 'Filtro por especialidad (contains, case-insensitive).',
        },
        page: { type: 'integer', minimum: 1, default: 1, description: 'Número de página (base 1).' },
        pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20, description: 'Tamaño de página (máximo 100).' },
        sortBy: {
          type: 'string',
          enum: ['email', 'nombre', 'apellido', 'especialidad', 'created_at', 'updated_at'],
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
              items: { type: 'array', items: usuarioShape },
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
                  email: { type: 'string' },
                  nombre: { type: 'string' },
                  apellido: { type: 'string' },
                  especialidad: { type: 'string' },
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

export const getUsuarioSchema = {
  schema: {
    tags: ['Core / Usuarios'],
    summary: 'Obtener usuario por ID',
    security: [{ bearerAuth: [] }],
    params: idParam,
    response: {
      200: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { type: 'object', required: ['usuario'], properties: { usuario: usuarioShape } },
          meta: envelopeMeta,
        },
      },
      401: errorEnvelope,
      403: errorEnvelope,
      404: errorEnvelope,
    },
  },
} as const;

export const createUsuarioSchema = {
  schema: {
    tags: ['Core / Usuarios'],
    summary: 'Crear usuario',
    description: 'Crea usuario del tenant, hashea password y opcionalmente asigna sedes/consultorios.',
    security: [{ bearerAuth: [] }],
    body: {
      type: 'object',
      required: ['rol_id', 'email', 'password', 'nombre', 'apellido'],
      properties: {
        rol_id: { type: 'string' },
        email: { type: 'string', format: 'email', maxLength: 200 },
        password: { type: 'string', minLength: 6, maxLength: 255 },
        nombre: { type: 'string', minLength: 2, maxLength: 150 },
        apellido: { type: 'string', minLength: 2, maxLength: 150 },
        especialidad: { type: 'string', maxLength: 100 },
        numero_colegiado: { type: 'string', maxLength: 50 },
        telefono: { type: 'string', maxLength: 30 },
        estado: { type: 'string', enum: ['activo', 'inactivo', 'suspendido'] },
        sedes: usuarioSedeInputShape,
      },
    },
    response: {
      201: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { type: 'object', required: ['usuario'], properties: { usuario: usuarioShape } },
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

export const updateUsuarioSchema = {
  schema: {
    tags: ['Core / Usuarios'],
    summary: 'Actualizar usuario',
    security: [{ bearerAuth: [] }],
    params: idParam,
    body: {
      type: 'object',
      additionalProperties: false,
      properties: {
        rol_id: { type: 'string' },
        email: { type: 'string', format: 'email', maxLength: 200 },
        password: { type: 'string', minLength: 6, maxLength: 255 },
        nombre: { type: 'string', minLength: 2, maxLength: 150 },
        apellido: { type: 'string', minLength: 2, maxLength: 150 },
        especialidad: { type: 'string', maxLength: 100 },
        numero_colegiado: { type: 'string', maxLength: 50 },
        telefono: { type: 'string', maxLength: 30 },
        estado: { type: 'string', enum: ['activo', 'inactivo', 'suspendido'] },
        sedes: usuarioSedeInputShape,
      },
    },
    response: {
      200: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { type: 'object', required: ['usuario'], properties: { usuario: usuarioShape } },
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

export const desactivarUsuarioSchema = {
  schema: {
    tags: ['Core / Usuarios'],
    summary: 'Desactivar usuario e invalidar refresh tokens',
    security: [{ bearerAuth: [] }],
    params: idParam,
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

export const deleteUsuarioSchema = {
  schema: {
    tags: ['Core / Usuarios'],
    summary: 'Eliminar usuario (soft delete) e invalidar refresh tokens',
    security: [{ bearerAuth: [] }],
    params: idParam,
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
