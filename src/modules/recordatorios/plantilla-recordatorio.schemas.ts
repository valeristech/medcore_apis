import {
  RECORDATORIO_CANALES,
  RECORDATORIO_HORAS_MAX,
  RECORDATORIO_HORAS_MIN,
} from './recordatorio.constants.js';

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

const plantillaShape = {
  type: 'object',
  required: ['id', 'organizacion_id', 'canal', 'horas_antes', 'texto'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    organizacion_id: { type: 'string', format: 'uuid' },
    canal: { type: 'string', enum: [...RECORDATORIO_CANALES] },
    horas_antes: { type: 'integer', minimum: RECORDATORIO_HORAS_MIN, maximum: RECORDATORIO_HORAS_MAX },
    asunto: { type: 'string', nullable: true },
    texto: { type: 'string' },
    activo: { type: 'boolean', nullable: true },
    created_at: { type: 'string', nullable: true },
  },
} as const;

const idParam = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;

const plantillaBodyProps = {
  canal: { type: 'string', enum: [...RECORDATORIO_CANALES] },
  horas_antes: { type: 'integer', minimum: RECORDATORIO_HORAS_MIN, maximum: RECORDATORIO_HORAS_MAX },
  asunto: { type: 'string', maxLength: 200 },
  texto: { type: 'string', minLength: 5 },
  activo: { type: 'boolean', default: true },
} as const;

export type CreatePlantillaRecordatorioInput = {
  canal: string;
  horas_antes: number;
  asunto?: string;
  texto: string;
  activo?: boolean;
};

export type UpdatePlantillaRecordatorioInput = Partial<CreatePlantillaRecordatorioInput>;

export type ListPlantillasRecordatorioQuery = {
  canal?: string;
  incluir_inactivos?: boolean;
  page?: number;
  pageSize?: number;
};

export const listPlantillasRecordatorioSchema = {
  schema: {
    tags: ['Agenda / Recordatorios'],
    summary: 'Listar plantillas de recordatorio',
    security: [{ bearerAuth: [] }],
    querystring: {
      type: 'object',
      additionalProperties: false,
      properties: {
        canal: { type: 'string', enum: [...RECORDATORIO_CANALES] },
        incluir_inactivos: { type: 'boolean', default: false },
        page: { type: 'integer', minimum: 1, default: 1 },
        pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              items: { type: 'array', items: plantillaShape },
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'integer' },
                  pageSize: { type: 'integer' },
                  total: { type: 'integer' },
                  totalPages: { type: 'integer' },
                },
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

export const createPlantillaRecordatorioSchema = {
  schema: {
    tags: ['Agenda / Recordatorios'],
    summary: 'Crear plantilla de recordatorio',
    description:
      'Variables en `texto`/`asunto`: {paciente_nombre}, {fecha}, {hora}, {medico}, {sede}, {tipo_cita}.',
    security: [{ bearerAuth: [] }],
    body: {
      type: 'object',
      required: ['canal', 'horas_antes', 'texto'],
      additionalProperties: false,
      properties: plantillaBodyProps,
    },
    response: {
      201: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object', properties: { plantilla: plantillaShape } },
          meta: envelopeMeta,
        },
      },
      400: errorEnvelope,
      401: errorEnvelope,
      403: errorEnvelope,
    },
  },
} as const;

export const getPlantillaRecordatorioSchema = {
  schema: {
    tags: ['Agenda / Recordatorios'],
    summary: 'Obtener plantilla de recordatorio',
    security: [{ bearerAuth: [] }],
    params: idParam,
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object', properties: { plantilla: plantillaShape } },
          meta: envelopeMeta,
        },
      },
      404: errorEnvelope,
    },
  },
} as const;

export const updatePlantillaRecordatorioSchema = {
  schema: {
    tags: ['Agenda / Recordatorios'],
    summary: 'Actualizar plantilla de recordatorio',
    security: [{ bearerAuth: [] }],
    params: idParam,
    body: {
      type: 'object',
      additionalProperties: false,
      minProperties: 1,
      properties: plantillaBodyProps,
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object', properties: { plantilla: plantillaShape } },
          meta: envelopeMeta,
        },
      },
      400: errorEnvelope,
      404: errorEnvelope,
    },
  },
} as const;

export const deletePlantillaRecordatorioSchema = {
  schema: {
    tags: ['Agenda / Recordatorios'],
    summary: 'Eliminar plantilla (soft delete)',
    security: [{ bearerAuth: [] }],
    params: idParam,
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object', properties: { ok: { type: 'boolean' } } },
          meta: envelopeMeta,
        },
      },
      404: errorEnvelope,
    },
  },
} as const;

export const ejecutarRecordatoriosSchema = {
  schema: {
    tags: ['Agenda / Recordatorios'],
    summary: 'Ejecutar job de recordatorios (cron/webhook)',
    description:
      'Protegido con `X-Cron-Secret` o `Authorization: Bearer <CRON_SECRET>`. Evalúa plantillas activas y envía recordatorios en la ventana `horas_antes` (±1h).',
    querystring: {
      type: 'object',
      additionalProperties: false,
      properties: {
        organizacion_id: { type: 'string', format: 'uuid', description: 'Opcional: limitar a un tenant.' },
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              ejecutado_en: { type: 'string' },
              plantillas_evaluadas: { type: 'integer' },
              citas_evaluadas: { type: 'integer' },
              enviados: { type: 'integer' },
              fallidos: { type: 'integer' },
              omitidos: { type: 'integer' },
              detalle: { type: 'array', items: { type: 'object', additionalProperties: true } },
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
