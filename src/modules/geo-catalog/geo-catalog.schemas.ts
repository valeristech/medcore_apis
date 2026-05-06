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
      properties: { code: { type: 'string' }, message: { type: 'string' }, details: {} },
    },
    meta: envelopeMeta,
  },
} as const;

export type CreateDepartamentoInput = { codigo: string; nombre: string; activo?: boolean };
export type UpdateDepartamentoInput = Partial<CreateDepartamentoInput>;
export type CreateMunicipioInput = {
  departamento_id: string;
  codigo: string;
  nombre: string;
  activo?: boolean;
};
export type UpdateMunicipioInput = Partial<Omit<CreateMunicipioInput, 'departamento_id'>> & {
  departamento_id?: string;
};

export type ListDepartamentosQuery = { q?: string; incluir_inactivos?: boolean };
export type ListMunicipiosQuery = { q?: string; incluir_inactivos?: boolean };

const departamentoShape = {
  type: 'object',
  required: ['id', 'organizacion_id', 'codigo', 'nombre'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    organizacion_id: { type: 'string', format: 'uuid' },
    codigo: { type: 'string' },
    nombre: { type: 'string' },
    activo: { type: 'boolean', nullable: true },
    created_at: { type: 'string', nullable: true },
    updated_at: { type: 'string', nullable: true },
  },
} as const;

const municipioShape = {
  type: 'object',
  required: ['id', 'organizacion_id', 'departamento_id', 'codigo', 'nombre'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    organizacion_id: { type: 'string', format: 'uuid' },
    departamento_id: { type: 'string', format: 'uuid' },
    codigo: { type: 'string' },
    nombre: { type: 'string' },
    activo: { type: 'boolean', nullable: true },
    created_at: { type: 'string', nullable: true },
    updated_at: { type: 'string', nullable: true },
  },
} as const;

const idParam = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;

const deptoIdParam = {
  type: 'object',
  required: ['departamentoId'],
  properties: { departamentoId: { type: 'string', format: 'uuid' } },
} as const;

export const listDepartamentosSchema = {
  schema: {
    tags: ['Core / Catálogo geográfico'],
    summary: 'Listar departamentos del tenant',
    security: [{ bearerAuth: [] }],
    querystring: {
      type: 'object',
      additionalProperties: false,
      properties: {
        q: { type: 'string', description: 'Filtro por nombre o código (contains, case-insensitive).' },
        incluir_inactivos: { type: 'boolean', default: false },
      },
    },
    response: {
      200: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { type: 'object', required: ['items'], properties: { items: { type: 'array', items: departamentoShape } } },
          meta: envelopeMeta,
        },
      },
      401: errorEnvelope,
      403: errorEnvelope,
    },
  },
} as const;

export const createDepartamentoSchema = {
  schema: {
    tags: ['Core / Catálogo geográfico'],
    summary: 'Crear departamento (catálogo)',
    security: [{ bearerAuth: [] }],
    body: {
      type: 'object',
      required: ['codigo', 'nombre'],
      additionalProperties: false,
      properties: {
        codigo: { type: 'string', minLength: 1, maxLength: 10 },
        nombre: { type: 'string', minLength: 1, maxLength: 100 },
        activo: { type: 'boolean' },
      },
    },
    response: {
      201: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { type: 'object', required: ['departamento'], properties: { departamento: departamentoShape } },
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

export const getDepartamentoSchema = {
  schema: {
    tags: ['Core / Catálogo geográfico'],
    summary: 'Obtener departamento por ID',
    security: [{ bearerAuth: [] }],
    params: idParam,
    response: {
      200: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { type: 'object', required: ['departamento'], properties: { departamento: departamentoShape } },
          meta: envelopeMeta,
        },
      },
      401: errorEnvelope,
      403: errorEnvelope,
      404: errorEnvelope,
    },
  },
} as const;

export const updateDepartamentoSchema = {
  schema: {
    tags: ['Core / Catálogo geográfico'],
    summary: 'Actualizar departamento',
    security: [{ bearerAuth: [] }],
    params: idParam,
    body: {
      type: 'object',
      additionalProperties: false,
      properties: {
        codigo: { type: 'string', minLength: 1, maxLength: 10 },
        nombre: { type: 'string', minLength: 1, maxLength: 100 },
        activo: { type: 'boolean' },
      },
    },
    response: {
      200: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { type: 'object', required: ['departamento'], properties: { departamento: departamentoShape } },
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

export const deleteDepartamentoSchema = {
  schema: {
    tags: ['Core / Catálogo geográfico'],
    summary: 'Eliminar departamento (soft delete)',
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
      409: errorEnvelope,
    },
  },
} as const;

export const listMunicipiosByDeptoSchema = {
  schema: {
    tags: ['Core / Catálogo geográfico'],
    summary: 'Listar municipios de un departamento',
    security: [{ bearerAuth: [] }],
    params: deptoIdParam,
    querystring: {
      type: 'object',
      additionalProperties: false,
      properties: {
        q: { type: 'string' },
        incluir_inactivos: { type: 'boolean', default: false },
      },
    },
    response: {
      200: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { type: 'object', required: ['items'], properties: { items: { type: 'array', items: municipioShape } } },
          meta: envelopeMeta,
        },
      },
      401: errorEnvelope,
      403: errorEnvelope,
      404: errorEnvelope,
    },
  },
} as const;

export const createMunicipioSchema = {
  schema: {
    tags: ['Core / Catálogo geográfico'],
    summary: 'Crear municipio',
    security: [{ bearerAuth: [] }],
    body: {
      type: 'object',
      required: ['departamento_id', 'codigo', 'nombre'],
      additionalProperties: false,
      properties: {
        departamento_id: { type: 'string', format: 'uuid' },
        codigo: { type: 'string', minLength: 1, maxLength: 15 },
        nombre: { type: 'string', minLength: 1, maxLength: 150 },
        activo: { type: 'boolean' },
      },
    },
    response: {
      201: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { type: 'object', required: ['municipio'], properties: { municipio: municipioShape } },
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

export const getMunicipioSchema = {
  schema: {
    tags: ['Core / Catálogo geográfico'],
    summary: 'Obtener municipio por ID',
    security: [{ bearerAuth: [] }],
    params: idParam,
    response: {
      200: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { type: 'object', required: ['municipio'], properties: { municipio: municipioShape } },
          meta: envelopeMeta,
        },
      },
      401: errorEnvelope,
      403: errorEnvelope,
      404: errorEnvelope,
    },
  },
} as const;

export const updateMunicipioSchema = {
  schema: {
    tags: ['Core / Catálogo geográfico'],
    summary: 'Actualizar municipio',
    security: [{ bearerAuth: [] }],
    params: idParam,
    body: {
      type: 'object',
      additionalProperties: false,
      properties: {
        departamento_id: { type: 'string', format: 'uuid' },
        codigo: { type: 'string', minLength: 1, maxLength: 15 },
        nombre: { type: 'string', minLength: 1, maxLength: 150 },
        activo: { type: 'boolean' },
      },
    },
    response: {
      200: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { type: 'object', required: ['municipio'], properties: { municipio: municipioShape } },
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

export const deleteMunicipioSchema = {
  schema: {
    tags: ['Core / Catálogo geográfico'],
    summary: 'Eliminar municipio (soft delete)',
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
      409: errorEnvelope,
    },
  },
} as const;
