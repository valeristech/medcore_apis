import {
  TIPO_CITA_DURACION_MAX,
  TIPO_CITA_DURACION_MIN,
} from './tipo-cita.constants.js';

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

export type CreateTipoCitaInput = {
  nombre: string;
  duracion_minutos: number;
  color?: string;
  aplica_telemedicina?: boolean;
  activo?: boolean;
};

export type UpdateTipoCitaInput = Partial<CreateTipoCitaInput>;

export type ListTiposCitaQuery = {
  q?: string;
  incluir_inactivos?: boolean;
};

const tipoCitaShape = {
  type: 'object',
  required: ['id', 'organizacion_id', 'nombre', 'duracion_minutos'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    organizacion_id: { type: 'string', format: 'uuid' },
    nombre: { type: 'string' },
    duracion_minutos: { type: 'integer', minimum: TIPO_CITA_DURACION_MIN, maximum: TIPO_CITA_DURACION_MAX },
    color: { type: 'string', nullable: true },
    aplica_telemedicina: { type: 'boolean', nullable: true },
    activo: { type: 'boolean', nullable: true },
    created_at: { type: 'string', nullable: true },
    deleted: { type: 'boolean', nullable: true },
    deleted_at: { type: 'string', nullable: true },
  },
} as const;

const idParam = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;

const tipoCitaBodyProps = {
  nombre: { type: 'string', minLength: 2, maxLength: 100 },
  duracion_minutos: {
    type: 'integer',
    minimum: TIPO_CITA_DURACION_MIN,
    maximum: TIPO_CITA_DURACION_MAX,
  },
  color: { type: 'string', maxLength: 10, description: 'Hex #RGB o #RRGGBB (p. ej. #2563EB).' },
  aplica_telemedicina: { type: 'boolean', default: false },
  activo: { type: 'boolean', default: true },
} as const;

export const listTiposCitaSchema = {
  schema: {
    tags: ['Agenda / Tipos de cita'],
    summary: 'Listar tipos de cita del tenant',
    security: [{ bearerAuth: [] }],
    querystring: {
      type: 'object',
      additionalProperties: false,
      properties: {
        q: { type: 'string', description: 'Filtro por nombre (contains, case-insensitive).' },
        incluir_inactivos: { type: 'boolean', default: false },
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
            required: ['items'],
            properties: { items: { type: 'array', items: tipoCitaShape } },
          },
          meta: envelopeMeta,
        },
      },
      401: errorEnvelope,
      403: errorEnvelope,
    },
  },
} as const;

export const createTipoCitaSchema = {
  schema: {
    tags: ['Agenda / Tipos de cita'],
    summary: 'Crear tipo de cita',
    security: [{ bearerAuth: [] }],
    body: {
      type: 'object',
      required: ['nombre', 'duracion_minutos'],
      additionalProperties: false,
      properties: tipoCitaBodyProps,
    },
    response: {
      201: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { type: 'object', required: ['tipo_cita'], properties: { tipo_cita: tipoCitaShape } },
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

export const getTipoCitaSchema = {
  schema: {
    tags: ['Agenda / Tipos de cita'],
    summary: 'Obtener tipo de cita por id',
    security: [{ bearerAuth: [] }],
    params: idParam,
    response: {
      200: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { type: 'object', required: ['tipo_cita'], properties: { tipo_cita: tipoCitaShape } },
          meta: envelopeMeta,
        },
      },
      401: errorEnvelope,
      403: errorEnvelope,
      404: errorEnvelope,
    },
  },
} as const;

export const updateTipoCitaSchema = {
  schema: {
    tags: ['Agenda / Tipos de cita'],
    summary: 'Actualizar tipo de cita',
    security: [{ bearerAuth: [] }],
    params: idParam,
    body: {
      type: 'object',
      additionalProperties: false,
      minProperties: 1,
      properties: tipoCitaBodyProps,
    },
    response: {
      200: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { type: 'object', required: ['tipo_cita'], properties: { tipo_cita: tipoCitaShape } },
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

export const deleteTipoCitaSchema = {
  schema: {
    tags: ['Agenda / Tipos de cita'],
    summary: 'Eliminar tipo de cita (soft delete)',
    security: [{ bearerAuth: [] }],
    params: idParam,
    response: {
      200: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean', enum: [true] } } },
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
