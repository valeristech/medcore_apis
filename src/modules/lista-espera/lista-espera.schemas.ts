import {
  LISTA_ESPERA_ESTADOS,
  LISTA_ESPERA_SORT_BY_VALUES,
  type ListaEsperaEstado,
} from './lista-espera.constants.js';

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

const metaProperties = { requestId: { type: 'string' } } as const;

export type CreateListaEsperaInput = {
  paciente_id: string;
  tipo_cita_id?: string | null;
  usuario_id?: string | null;
  fecha_desde?: string | null;
  fecha_hasta?: string | null;
  notas?: string | null;
  estado?: ListaEsperaEstado;
};

export type UpdateListaEsperaInput = {
  tipo_cita_id?: string | null;
  usuario_id?: string | null;
  fecha_desde?: string | null;
  fecha_hasta?: string | null;
  notas?: string | null;
  estado?: ListaEsperaEstado;
};

export type ListListaEsperaQuery = {
  q?: string;
  estado?: string;
  solo_activas?: boolean;
  usuario_id?: string;
  tipo_cita_id?: string;
  paciente_id?: string;
  page?: number;
  pageSize?: number;
  sortBy?: (typeof LISTA_ESPERA_SORT_BY_VALUES)[number];
  sortOrder?: 'asc' | 'desc';
};

export type ListListaEsperaSugerenciasQuery = {
  usuario_id?: string;
  tipo_cita_id?: string;
  fecha?: string;
  limit?: number;
};

const idParam = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;

const pacienteResumen = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    nombre: { type: 'string' },
    apellido: { type: 'string' },
    telefono: { type: 'string', nullable: true },
    email: { type: 'string', nullable: true },
  },
} as const;

const tipoCitaResumen = {
  type: 'object',
  nullable: true,
  properties: {
    id: { type: 'string', format: 'uuid' },
    nombre: { type: 'string' },
    duracion_minutos: { type: 'integer', nullable: true },
    color: { type: 'string', nullable: true },
  },
} as const;

const usuarioResumen = {
  type: 'object',
  nullable: true,
  properties: {
    id: { type: 'string', format: 'uuid' },
    nombre: { type: 'string' },
    apellido: { type: 'string' },
    especialidad: { type: 'string', nullable: true },
  },
} as const;

export const listaEsperaItemShape = {
  type: 'object',
  required: ['id', 'paciente_id'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    paciente_id: { type: 'string', format: 'uuid' },
    tipo_cita_id: { type: 'string', format: 'uuid', nullable: true },
    usuario_id: { type: 'string', format: 'uuid', nullable: true },
    fecha_desde: { type: 'string', format: 'date', nullable: true },
    fecha_hasta: { type: 'string', format: 'date', nullable: true },
    notas: { type: 'string', nullable: true },
    estado: { type: 'string', enum: [...LISTA_ESPERA_ESTADOS], nullable: true },
    fecha_solicitud: { type: 'string', nullable: true },
    created_at: { type: 'string', nullable: true },
    paciente: pacienteResumen,
    tipo_cita: tipoCitaResumen,
    usuario: usuarioResumen,
  },
} as const;

export const listaEsperaSugerenciasShape = {
  type: 'object',
  required: ['total', 'items'],
  properties: {
    total: { type: 'integer' },
    items: { type: 'array', items: listaEsperaItemShape },
  },
} as const;

const listaEsperaBodyProps = {
  paciente_id: { type: 'string', format: 'uuid' },
  tipo_cita_id: { type: 'string', format: 'uuid', nullable: true },
  usuario_id: { type: 'string', format: 'uuid', nullable: true, description: 'Médico preferido (usuario del tenant).' },
  fecha_desde: { type: 'string', format: 'date', nullable: true, description: 'YYYY-MM-DD' },
  fecha_hasta: { type: 'string', format: 'date', nullable: true, description: 'YYYY-MM-DD' },
  notas: { type: 'string', maxLength: 4000, nullable: true },
  estado: { type: 'string', enum: [...LISTA_ESPERA_ESTADOS], default: 'activa' },
} as const;

export const listListaEsperaSchema = {
  schema: {
    tags: ['Agenda / Lista de espera'],
    summary: 'Listar entradas de lista de espera',
    description:
      'Entradas del tenant (vía paciente_organizacion). Filtros: estado, solo_activas, usuario_id, tipo_cita_id, paciente_id, q (nombre/apellido). Orden por fecha_solicitud (FIFO) por defecto.',
    security: [{ bearerAuth: [] }],
    querystring: {
      type: 'object',
      additionalProperties: false,
      properties: {
        q: { type: 'string' },
        estado: { type: 'string', enum: [...LISTA_ESPERA_ESTADOS] },
        solo_activas: { type: 'boolean', default: false },
        usuario_id: { type: 'string', format: 'uuid' },
        tipo_cita_id: { type: 'string', format: 'uuid' },
        paciente_id: { type: 'string', format: 'uuid' },
        page: { type: 'integer', minimum: 1, default: 1 },
        pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        sortBy: {
          type: 'string',
          enum: [...LISTA_ESPERA_SORT_BY_VALUES],
          default: 'fecha_solicitud',
        },
        sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
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
              items: { type: 'array', items: listaEsperaItemShape },
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
                properties: {
                  sortBy: { type: 'string' },
                  sortOrder: { type: 'string' },
                },
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

export const listListaEsperaSugerenciasSchema = {
  schema: {
    tags: ['Agenda / Lista de espera'],
    summary: 'Sugerencias para un slot liberado',
    description:
      'Pacientes en estado `activa`, ordenados por `fecha_solicitud` (FIFO). Coincidencia flexible: `usuario_id`/`tipo_cita_id` null = cualquiera. Opcional `fecha` (YYYY-MM-DD) para respetar ventana fecha_desde/fecha_hasta.',
    security: [{ bearerAuth: [] }],
    querystring: {
      type: 'object',
      additionalProperties: false,
      properties: {
        usuario_id: { type: 'string', format: 'uuid' },
        tipo_cita_id: { type: 'string', format: 'uuid' },
        fecha: { type: 'string', format: 'date', description: 'Fecha del hueco liberado (YYYY-MM-DD).' },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: listaEsperaSugerenciasShape,
          meta: { type: 'object', properties: metaProperties },
        },
      },
      401: errorEnvelope,
      403: errorEnvelope,
    },
  },
} as const;

export const createListaEsperaSchema = {
  schema: {
    tags: ['Agenda / Lista de espera'],
    summary: 'Agregar paciente a lista de espera',
    description:
      'UC-AGE-007: cuando no hay disponibilidad, la secretaría registra al paciente. No permite duplicados activos con mismo paciente, médico y tipo.',
    security: [{ bearerAuth: [] }],
    body: {
      type: 'object',
      required: ['paciente_id'],
      additionalProperties: false,
      properties: listaEsperaBodyProps,
    },
    response: {
      201: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: { lista_espera: listaEsperaItemShape },
          },
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

export const getListaEsperaSchema = {
  schema: {
    tags: ['Agenda / Lista de espera'],
    summary: 'Detalle de entrada en lista de espera',
    security: [{ bearerAuth: [] }],
    params: idParam,
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object', properties: { lista_espera: listaEsperaItemShape } },
          meta: { type: 'object', properties: metaProperties },
        },
      },
      401: errorEnvelope,
      403: errorEnvelope,
      404: errorEnvelope,
    },
  },
} as const;

export const updateListaEsperaSchema = {
  schema: {
    tags: ['Agenda / Lista de espera'],
    summary: 'Actualizar entrada (estado, fechas, médico, tipo)',
    security: [{ bearerAuth: [] }],
    params: idParam,
    body: {
      type: 'object',
      additionalProperties: false,
      minProperties: 1,
      properties: {
        tipo_cita_id: { type: 'string', format: 'uuid', nullable: true },
        usuario_id: { type: 'string', format: 'uuid', nullable: true },
        fecha_desde: { type: 'string', format: 'date', nullable: true },
        fecha_hasta: { type: 'string', format: 'date', nullable: true },
        notas: { type: 'string', maxLength: 4000, nullable: true },
        estado: { type: 'string', enum: [...LISTA_ESPERA_ESTADOS] },
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object', properties: { lista_espera: listaEsperaItemShape } },
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

export const deleteListaEsperaSchema = {
  schema: {
    tags: ['Agenda / Lista de espera'],
    summary: 'Eliminar entrada (soft delete)',
    security: [{ bearerAuth: [] }],
    params: idParam,
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object', properties: { ok: { type: 'boolean' } } },
          meta: { type: 'object', properties: metaProperties },
        },
      },
      401: errorEnvelope,
      403: errorEnvelope,
      404: errorEnvelope,
    },
  },
} as const;
