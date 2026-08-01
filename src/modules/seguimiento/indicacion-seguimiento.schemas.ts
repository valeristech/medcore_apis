import { TIPO_INDICACION_SEGUIMIENTO_VALUES, ESTADO_INDICACION_SEGUIMIENTO_VALUES } from '../../core/enums/seguimiento.enums.js';
import { PRIORIDAD_VALUES } from '../../core/enums/comun.enums.js';
import { ESTADOS_GESTIONABLES, INDICACION_SORT_BY_VALUES } from './indicacion-seguimiento.constants.js';

export type CrearIndicacionSeguimientoInput = {
  encuentro_id: string;
  tipo: string;
  descripcion: string;
  /** Plazo — usar exactamente una de estas tres formas. */
  dias_para_cita?: number;
  fecha_sugerida?: string;
  rango_fecha_inicio?: string;
  rango_fecha_fin?: string;
  /** Default: `normal`. */
  prioridad?: string;
  /** Notas del médico dirigidas a secretaría (persisten en `notas_medico`). */
  notas?: string;
};

export type ListIndicacionesSeguimientoQuery = {
  estado?: string;
  medico_id?: string;
  paciente_id?: string;
  prioridad?: string;
  page?: number;
  pageSize?: number;
  sortBy?: (typeof INDICACION_SORT_BY_VALUES)[number];
  sortOrder?: 'asc' | 'desc';
};

export type ActualizarGestionIndicacionInput = {
  estado?: string;
  notas_secretaria?: string;
  /** ISO-8601. Marca el momento en que se contactó (o intentó contactar) al paciente. */
  fecha_contacto_paciente?: string;
  preferencia_horario?: string;
  /** Si es `true`, incrementa `intentos_contacto` en 1. */
  registrar_intento?: boolean;
};

export type AgendarCitaIndicacionInput = {
  /** Default: `indicacion.medico_id`. */
  usuario_id?: string;
  consultorio_id: string;
  sede_id: string;
  tipo_cita_id: string;
  fecha_hora_inicio: string;
  fecha_hora_fin?: string;
  notas?: string;
  timezone?: string;
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

const usuarioResumenShape = {
  type: 'object',
  nullable: true,
  properties: {
    id: { type: 'string', format: 'uuid' },
    nombre: { type: 'string' },
    apellido: { type: 'string' },
    especialidad: { type: 'string', nullable: true },
  },
} as const;

const pacienteContactoShape = {
  type: 'object',
  nullable: true,
  properties: {
    id: { type: 'string', format: 'uuid' },
    nombre: { type: 'string' },
    apellido: { type: 'string' },
    telefono: { type: 'string', nullable: true },
    telefono_secundario: { type: 'string', nullable: true },
    email: { type: 'string', nullable: true },
  },
} as const;

const citaGeneradaShape = {
  type: 'object',
  nullable: true,
  properties: {
    id: { type: 'string', format: 'uuid' },
    estado: { type: 'string' },
    fecha_hora_inicio: { type: 'string', format: 'date-time' },
    fecha_hora_fin: { type: 'string', format: 'date-time' },
  },
} as const;

const indicacionSeguimientoShape = {
  type: 'object',
  required: [
    'id',
    'encuentro_id',
    'paciente_id',
    'medico_id',
    'organizacion_id',
    'tipo',
    'descripcion',
    'prioridad',
    'estado',
  ],
  properties: {
    id: { type: 'string', format: 'uuid' },
    encuentro_id: { type: 'string', format: 'uuid' },
    paciente_id: { type: 'string', format: 'uuid' },
    medico_id: { type: 'string', format: 'uuid' },
    organizacion_id: { type: 'string', format: 'uuid' },
    tipo: { type: 'string' },
    descripcion: { type: 'string' },
    dias_para_cita: { type: 'integer', nullable: true },
    fecha_sugerida: { type: 'string', format: 'date', nullable: true },
    rango_fecha_inicio: { type: 'string', format: 'date', nullable: true },
    rango_fecha_fin: { type: 'string', format: 'date', nullable: true },
    prioridad: { type: 'string', nullable: true },
    notas_medico: { type: 'string', nullable: true },
    estado: { type: 'string' },
    atendida_por: { type: 'string', format: 'uuid', nullable: true },
    fecha_gestion: { type: 'string', nullable: true },
    notas_secretaria: { type: 'string', nullable: true },
    fecha_contacto_paciente: { type: 'string', nullable: true },
    preferencia_horario: { type: 'string', nullable: true },
    intentos_contacto: { type: 'integer', nullable: true },
    cita_generada_id: { type: 'string', format: 'uuid', nullable: true },
    created_at: { type: 'string', nullable: true },
    updated_at: { type: 'string', nullable: true },
    paciente: pacienteContactoShape,
    medico: usuarioResumenShape,
    atendida_por_usuario: usuarioResumenShape,
    cita: citaGeneradaShape,
  },
} as const;

export const crearIndicacionSeguimientoSchema = {
  schema: {
    tags: ['Seguimiento / Indicaciones'],
    summary: 'Médico indica seguimiento (UC-SEG-001)',
    description:
      'Formulario rápido desde la consulta: el médico registra que el paciente necesita seguimiento ' +
      '(cita de control, estudio, vacuna, procedimiento u otro) sin agendar la cita todavía. ' +
      'Requiere indicar un plazo mediante `dias_para_cita`, `fecha_sugerida` o un rango ' +
      '(`rango_fecha_inicio` + `rango_fecha_fin`). Solo el médico dueño del `encuentro` puede crearla. ' +
      'Se crea en estado `pendiente` y queda visible en la bandeja de secretaría.',
    security: [{ bearerAuth: [] }],
    body: {
      type: 'object',
      required: ['encuentro_id', 'tipo', 'descripcion'],
      additionalProperties: false,
      properties: {
        encuentro_id: { type: 'string', format: 'uuid' },
        tipo: { type: 'string', enum: TIPO_INDICACION_SEGUIMIENTO_VALUES },
        descripcion: { type: 'string', minLength: 3, maxLength: 2000 },
        dias_para_cita: {
          type: 'integer',
          minimum: 0,
          maximum: 3650,
          description: 'Días desde hoy en que se sugiere agendar.',
        },
        fecha_sugerida: { type: 'string', format: 'date' },
        rango_fecha_inicio: {
          type: 'string',
          format: 'date',
          description: 'Requiere enviarse junto con `rango_fecha_fin`.',
        },
        rango_fecha_fin: { type: 'string', format: 'date' },
        prioridad: { type: 'string', enum: PRIORIDAD_VALUES, default: 'normal' },
        notas: { type: 'string', maxLength: 2000, description: 'Notas del médico para secretaría.' },
      },
    },
    response: {
      201: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            required: ['indicacion'],
            properties: { indicacion: indicacionSeguimientoShape },
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

export const listIndicacionesSeguimientoSchema = {
  schema: {
    tags: ['Seguimiento / Indicaciones'],
    summary: 'Bandeja de secretaría — listar/filtrar indicaciones (UC-SEG-002)',
    description:
      'Filtra por `estado` (default: `pendiente`+`en_gestion`+`no_contactado`, la bandeja activa), ' +
      '`medico_id`, `paciente_id` y `prioridad`. Incluye datos de contacto del paciente. ' +
      'Orden por defecto (`sortBy=prioridad`): urgencia (`critica`→`alta`→`normal`→`baja`) y luego ' +
      'antigüedad (más antigua primero). `sortBy=created_at` ordena solo por antigüedad (`sortOrder`).',
    security: [{ bearerAuth: [] }],
    querystring: {
      type: 'object',
      additionalProperties: false,
      properties: {
        estado: { type: 'string', enum: ESTADO_INDICACION_SEGUIMIENTO_VALUES },
        medico_id: { type: 'string', format: 'uuid' },
        paciente_id: { type: 'string', format: 'uuid' },
        prioridad: { type: 'string', enum: PRIORIDAD_VALUES },
        page: { type: 'integer', minimum: 1, default: 1 },
        pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        sortBy: { type: 'string', enum: [...INDICACION_SORT_BY_VALUES], default: 'prioridad' },
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
              items: { type: 'array', items: indicacionSeguimientoShape },
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
      400: errorEnvelope,
      401: errorEnvelope,
      403: errorEnvelope,
    },
  },
} as const;

export const actualizarGestionIndicacionSchema = {
  schema: {
    tags: ['Seguimiento / Indicaciones'],
    summary: 'Actualizar gestión de una indicación (UC-SEG-002)',
    description:
      'Secretaría registra el resultado de la gestión: contacto con el paciente, preferencia de horario, ' +
      'intentos de contacto y notas. Transiciones de `estado` permitidas: ' +
      `${ESTADOS_GESTIONABLES.join(', ')} (\`agendada\` es terminal y solo se alcanza vía ` +
      '`POST /:id/agendar-cita`). Marca automáticamente `atendida_por` (usuario autenticado) y `fecha_gestion`.',
    security: [{ bearerAuth: [] }],
    params: idParam,
    body: {
      type: 'object',
      additionalProperties: false,
      minProperties: 1,
      properties: {
        estado: { type: 'string', enum: [...ESTADOS_GESTIONABLES] },
        notas_secretaria: { type: 'string', maxLength: 2000 },
        fecha_contacto_paciente: { type: 'string', format: 'date-time' },
        preferencia_horario: { type: 'string', maxLength: 50 },
        registrar_intento: { type: 'boolean', description: 'Incrementa intentos_contacto en 1.' },
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            required: ['indicacion'],
            properties: { indicacion: indicacionSeguimientoShape },
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

export const agendarCitaIndicacionSchema = {
  schema: {
    tags: ['Seguimiento / Indicaciones'],
    summary: 'Cerrar el ciclo: agendar la cita de la indicación (UC-SEG-002)',
    description:
      'Reutiliza el módulo de citas (`POST /api/citas`) para crear la cita — mismas validaciones de ' +
      'tenant, conflictos y disponibilidad — y la vincula a la indicación (`cita_generada_id`), pasando ' +
      'su estado a `agendada`. Por defecto agenda con el médico que indicó el seguimiento (`medico_id`); ' +
      'puede sobreescribirse con `usuario_id`. No permitido si la indicación ya fue agendada.',
    security: [{ bearerAuth: [] }],
    params: idParam,
    body: {
      type: 'object',
      required: ['consultorio_id', 'sede_id', 'tipo_cita_id', 'fecha_hora_inicio'],
      additionalProperties: false,
      properties: {
        usuario_id: {
          type: 'string',
          format: 'uuid',
          description: 'Médico que atenderá; default: el médico de la indicación.',
        },
        consultorio_id: { type: 'string', format: 'uuid' },
        sede_id: { type: 'string', format: 'uuid' },
        tipo_cita_id: { type: 'string', format: 'uuid' },
        fecha_hora_inicio: { type: 'string', format: 'date-time' },
        fecha_hora_fin: {
          type: 'string',
          format: 'date-time',
          description: 'Opcional; si se omite se usa `duracion_minutos` del tipo de cita.',
        },
        notas: { type: 'string', maxLength: 2000 },
        timezone: {
          type: 'string',
          description: 'Zona IANA para validar disponibilidad (p. ej. America/Guatemala).',
        },
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            required: ['indicacion', 'cita'],
            properties: {
              indicacion: indicacionSeguimientoShape,
              cita: { type: 'object', additionalProperties: true },
            },
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
