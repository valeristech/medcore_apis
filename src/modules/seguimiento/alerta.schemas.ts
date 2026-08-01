import {
  ESTADO_ALERTA_VALUES,
  TIPO_ALERTA_VALUES,
  VISIBLE_PARA_ALERTA_VALUES,
} from '../../core/enums/seguimiento.enums.js';
import { PRIORIDAD_VALUES } from '../../core/enums/comun.enums.js';
import { ALERTA_ESTADOS_GESTIONABLES, ALERTA_SORT_BY_VALUES } from './alerta.constants.js';

export type ListAlertasQuery = {
  estado?: string;
  visible_para?: string;
  prioridad?: string;
  tipo?: string;
  paciente_id?: string;
  page?: number;
  pageSize?: number;
  sortBy?: (typeof ALERTA_SORT_BY_VALUES)[number];
  sortOrder?: 'asc' | 'desc';
};

export type GestionarAlertaInput = {
  estado: string;
  notas?: string;
};

const envelopeMeta = {
  type: 'object',
  required: ['requestId'],
  properties: { requestId: { type: 'string' } },
} as const;

const metaProperties = envelopeMeta.properties;

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

const idParam = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;

const pacienteResumenShape = {
  type: 'object',
  nullable: true,
  properties: {
    id: { type: 'string', format: 'uuid' },
    nombre: { type: 'string' },
    apellido: { type: 'string' },
    telefono: { type: 'string', nullable: true },
  },
} as const;

const usuarioResumenShape = {
  type: 'object',
  nullable: true,
  properties: {
    id: { type: 'string', format: 'uuid' },
    nombre: { type: 'string' },
    apellido: { type: 'string' },
  },
} as const;

const alertaShape = {
  type: 'object',
  required: ['id', 'organizacion_id', 'paciente_id', 'tipo', 'titulo', 'estado'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    organizacion_id: { type: 'string', format: 'uuid' },
    paciente_id: { type: 'string', format: 'uuid' },
    plan_id: { type: 'string', format: 'uuid', nullable: true },
    actividad_id: { type: 'string', format: 'uuid', nullable: true },
    indicacion_id: { type: 'string', format: 'uuid', nullable: true },
    tipo: { type: 'string' },
    titulo: { type: 'string' },
    descripcion: { type: 'string', nullable: true },
    prioridad: { type: 'string', nullable: true },
    estado: { type: 'string' },
    visible_para: { type: 'string', nullable: true },
    gestionada_por: { type: 'string', format: 'uuid', nullable: true },
    fecha_gestion: { type: 'string', nullable: true },
    notas_gestion: { type: 'string', nullable: true },
    fecha_vencimiento: { type: 'string', format: 'date', nullable: true },
    created_at: { type: 'string', nullable: true },
    paciente: pacienteResumenShape,
    usuario: usuarioResumenShape,
  },
} as const;

export const listAlertasSchema = {
  schema: {
    tags: ['Seguimiento / Alertas'],
    summary: 'Bandeja de alertas preventivas — listar/filtrar (UC-SEG-004)',
    description:
      'Filtra por `estado` (default: `activa`), `visible_para`, `prioridad`, `tipo` y `paciente_id`, ' +
      'siempre acotado al tenant. Orden por defecto (`sortBy=prioridad`): urgencia ' +
      '(`critica`→`alta`→`normal`→`baja`) y luego antigüedad (más antigua primero). ' +
      '`sortBy=created_at` ordena solo por antigüedad (`sortOrder`).',
    security: [{ bearerAuth: [] }],
    querystring: {
      type: 'object',
      additionalProperties: false,
      properties: {
        estado: { type: 'string', enum: ESTADO_ALERTA_VALUES },
        visible_para: { type: 'string', enum: VISIBLE_PARA_ALERTA_VALUES },
        prioridad: { type: 'string', enum: PRIORIDAD_VALUES },
        tipo: { type: 'string', enum: TIPO_ALERTA_VALUES },
        paciente_id: { type: 'string', format: 'uuid' },
        page: { type: 'integer', minimum: 1, default: 1 },
        pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        sortBy: { type: 'string', enum: [...ALERTA_SORT_BY_VALUES], default: 'prioridad' },
        sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
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
              items: { type: 'array', items: alertaShape },
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'integer' },
                  pageSize: { type: 'integer' },
                  total: { type: 'integer' },
                  totalPages: { type: 'integer' },
                },
              },
              sort: {
                type: 'object',
                properties: { sortBy: { type: 'string' }, sortOrder: { type: 'string' } },
              },
            },
          },
          meta: { type: 'object', properties: metaProperties },
        },
      },
      401: errorEnvelope,
      403: errorEnvelope,
    },
  },
} as const;

export const gestionarAlertaSchema = {
  schema: {
    tags: ['Seguimiento / Alertas'],
    summary: 'Gestionar o cerrar una alerta (UC-SEG-004)',
    description:
      'Marca la alerta como `gestionada` o `cerrada` (`estado` requerido: ' +
      `${ALERTA_ESTADOS_GESTIONABLES.join(', ')}` +
      '). Registra automáticamente `gestionada_por` (usuario autenticado) y `fecha_gestion`. ' +
      'No permitido si la alerta ya está `cerrada` (estado terminal).',
    security: [{ bearerAuth: [] }],
    params: idParam,
    body: {
      type: 'object',
      required: ['estado'],
      additionalProperties: false,
      properties: {
        estado: { type: 'string', enum: [...ALERTA_ESTADOS_GESTIONABLES] },
        notas: { type: 'string', maxLength: 2000 },
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object', required: ['alerta'], properties: { alerta: alertaShape } },
          meta: { type: 'object', properties: metaProperties },
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

export const ejecutarAlertaJobSchema = {
  schema: {
    tags: ['Seguimiento / Alertas'],
    summary: 'Job diario: generar alertas a partir de planes e indicaciones vencidas',
    description:
      'Uso exclusivo de cron externo (`X-Cron-Secret`). Genera alertas `activa` (idempotente por ' +
      'tipo + origen) para: `control_vencido` (indicaciones activas cuyo plazo ya pasó), ' +
      '`paciente_sin_contacto` (indicaciones `no_contactado` con intentos de contacto ≥3), ' +
      '`actividad_pendiente` (actividades de plan `vencida`) y `plan_abandonado` (planes `activo` ' +
      'cuyas actividades están todas `vencida`).',
    querystring: {
      type: 'object',
      additionalProperties: false,
      properties: { organizacion_id: { type: 'string', format: 'uuid' } },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object', additionalProperties: true },
          meta: { type: 'object', properties: metaProperties },
        },
      },
      401: errorEnvelope,
      503: errorEnvelope,
    },
  },
} as const;
