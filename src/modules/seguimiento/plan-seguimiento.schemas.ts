import { TIPO_INDICACION_SEGUIMIENTO_VALUES } from '../../core/enums/seguimiento.enums.js';
import { ESTADO_PLAN_SEGUIMIENTO_VALUES, ESTADO_ACTIVIDAD_SEGUIMIENTO_VALUES } from '../../core/enums/seguimiento.enums.js';
import { ESTADOS_ACTIVIDAD_GESTIONABLES, PLAN_SORT_BY_VALUES } from './plan-seguimiento.constants.js';

export type CrearPlanSeguimientoInput = {
  paciente_id: string;
  /** Encuentro desde el que se abre el plan (opcional). Si se envía, valida que el médico lo posea. */
  encuentro_origen_id?: string;
  nombre: string;
  indicacion_medico?: string;
  diagnostico_asociado?: string;
  codigo_icd10?: string;
  frecuencia_dias?: number;
  descripcion?: string;
  /** YYYY-MM-DD. Default: hoy. */
  fecha_inicio?: string;
  /** YYYY-MM-DD. */
  fecha_fin_estimada?: string;
};

export type ListPlanesSeguimientoQuery = {
  estado?: string;
  paciente_id?: string;
  medico_id?: string;
  page?: number;
  pageSize?: number;
  sortBy?: (typeof PLAN_SORT_BY_VALUES)[number];
  sortOrder?: 'asc' | 'desc';
};

export type CambiarEstadoPlanInput = {
  estado: string;
  /** Requerido cuando `estado` es `cancelado`. */
  motivo_cierre?: string;
};

export type CrearActividadInput = {
  tipo: string;
  descripcion: string;
  fecha_programada?: string;
  fecha_limite?: string;
  dias_desde_inicio?: number;
  instrucciones_paciente?: string;
  requiere_preparacion?: boolean;
  detalle_preparacion?: string;
  /** Default: siguiente correlativo del plan. */
  numero_orden?: number;
};

export type ActualizarActividadInput = {
  tipo?: string;
  descripcion?: string;
  fecha_programada?: string | null;
  fecha_limite?: string | null;
  dias_desde_inicio?: number | null;
  instrucciones_paciente?: string | null;
  requiere_preparacion?: boolean;
  detalle_preparacion?: string | null;
  numero_orden?: number;
  /** Restringido a: pendiente, completada, cancelada. */
  estado?: string;
  resultado_resumen?: string;
  notas?: string;
};

export type ListActividadesQuery = {
  estado?: string;
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

export const actividadSeguimientoShape = {
  type: 'object',
  required: ['id', 'plan_id', 'numero_orden', 'tipo', 'descripcion', 'estado'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    plan_id: { type: 'string', format: 'uuid' },
    numero_orden: { type: 'integer' },
    tipo: { type: 'string' },
    descripcion: { type: 'string' },
    fecha_programada: { type: 'string', format: 'date', nullable: true },
    fecha_limite: { type: 'string', format: 'date', nullable: true },
    dias_desde_inicio: { type: 'integer', nullable: true },
    instrucciones_paciente: { type: 'string', nullable: true },
    requiere_preparacion: { type: 'boolean', nullable: true },
    detalle_preparacion: { type: 'string', nullable: true },
    creada_por: { type: 'string', format: 'uuid', nullable: true },
    indicacion_id: { type: 'string', format: 'uuid', nullable: true },
    cita_id: { type: 'string', format: 'uuid', nullable: true },
    encuentro_id: { type: 'string', format: 'uuid', nullable: true },
    estudio_id: { type: 'string', format: 'uuid', nullable: true },
    estado: { type: 'string' },
    gestionada_por: { type: 'string', format: 'uuid', nullable: true },
    fecha_gestion: { type: 'string', nullable: true },
    resultado_resumen: { type: 'string', nullable: true },
    notas: { type: 'string', nullable: true },
    created_at: { type: 'string', nullable: true },
    updated_at: { type: 'string', nullable: true },
  },
} as const;

const planSeguimientoShape = {
  type: 'object',
  required: ['id', 'paciente_id', 'organizacion_id', 'medico_id', 'nombre', 'estado'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    paciente_id: { type: 'string', format: 'uuid' },
    organizacion_id: { type: 'string', format: 'uuid' },
    medico_id: { type: 'string', format: 'uuid' },
    encuentro_origen_id: { type: 'string', format: 'uuid', nullable: true },
    nombre: { type: 'string' },
    indicacion_medico: { type: 'string', nullable: true },
    diagnostico_asociado: { type: 'string', nullable: true },
    codigo_icd10: { type: 'string', nullable: true },
    frecuencia_dias: { type: 'integer', nullable: true },
    descripcion: { type: 'string', nullable: true },
    fecha_inicio: { type: 'string', format: 'date', nullable: true },
    fecha_fin_estimada: { type: 'string', format: 'date', nullable: true },
    completado_por: { type: 'string', format: 'uuid', nullable: true },
    fecha_completado: { type: 'string', nullable: true },
    notas_secretaria: { type: 'string', nullable: true },
    estado: { type: 'string' },
    motivo_cierre: { type: 'string', nullable: true },
    created_at: { type: 'string', nullable: true },
    updated_at: { type: 'string', nullable: true },
    paciente: pacienteResumenShape,
    medico: usuarioResumenShape,
    actividades: { type: 'array', items: actividadSeguimientoShape },
  },
} as const;

export const crearPlanSeguimientoSchema = {
  schema: {
    tags: ['Seguimiento / Planes'],
    summary: 'Médico abre un plan de seguimiento (UC-SEG-003)',
    description:
      'Crea el plan en estado `borrador`: nombre, indicación general, diagnóstico/ICD-10 y frecuencia. ' +
      'Si se envía `encuentro_origen_id`, valida que el médico autenticado sea su dueño. ' +
      'La secretaría lo completa después con actividades (`POST /:id/actividades`) y lo activa ' +
      '(`PUT /:id/estado`).',
    security: [{ bearerAuth: [] }],
    body: {
      type: 'object',
      required: ['paciente_id', 'nombre'],
      additionalProperties: false,
      properties: {
        paciente_id: { type: 'string', format: 'uuid' },
        encuentro_origen_id: { type: 'string', format: 'uuid' },
        nombre: { type: 'string', minLength: 3, maxLength: 200 },
        indicacion_medico: { type: 'string', maxLength: 2000 },
        diagnostico_asociado: { type: 'string', maxLength: 300 },
        codigo_icd10: { type: 'string', maxLength: 20 },
        frecuencia_dias: { type: 'integer', minimum: 1, maximum: 3650 },
        descripcion: { type: 'string', maxLength: 4000 },
        fecha_inicio: { type: 'string', format: 'date' },
        fecha_fin_estimada: { type: 'string', format: 'date' },
      },
    },
    response: {
      201: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object', required: ['plan'], properties: { plan: planSeguimientoShape } },
          meta: { type: 'object', properties: metaProperties },
        },
      },
      400: errorEnvelope,
      401: errorEnvelope,
      403: errorEnvelope,
      404: errorEnvelope,
    },
  },
} as const;

export const listPlanesSeguimientoSchema = {
  schema: {
    tags: ['Seguimiento / Planes'],
    summary: 'Listar/filtrar planes de seguimiento',
    description: 'Filtra por estado, paciente_id, medico_id. Orden por defecto: created_at desc.',
    security: [{ bearerAuth: [] }],
    querystring: {
      type: 'object',
      additionalProperties: false,
      properties: {
        estado: { type: 'string', enum: ESTADO_PLAN_SEGUIMIENTO_VALUES },
        paciente_id: { type: 'string', format: 'uuid' },
        medico_id: { type: 'string', format: 'uuid' },
        page: { type: 'integer', minimum: 1, default: 1 },
        pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        sortBy: { type: 'string', enum: [...PLAN_SORT_BY_VALUES], default: 'created_at' },
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
              items: { type: 'array', items: planSeguimientoShape },
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

export const getPlanSeguimientoSchema = {
  schema: {
    tags: ['Seguimiento / Planes'],
    summary: 'Detalle del plan (incluye actividades)',
    security: [{ bearerAuth: [] }],
    params: idParam,
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object', properties: { plan: planSeguimientoShape } },
          meta: { type: 'object', properties: metaProperties },
        },
      },
      401: errorEnvelope,
      403: errorEnvelope,
      404: errorEnvelope,
    },
  },
} as const;

export const cambiarEstadoPlanSchema = {
  schema: {
    tags: ['Seguimiento / Planes'],
    summary: 'Cambiar estado del plan (activar / completar / cancelar)',
    description:
      'Transiciones válidas: `borrador`→`activo`|`cancelado`, `activo`→`completado`|`cancelado`. ' +
      '`activo` requiere al menos una actividad. `cancelado` requiere `motivo_cierre`. ' +
      '`completado`/`cancelado` son terminales.',
    security: [{ bearerAuth: [] }],
    params: idParam,
    body: {
      type: 'object',
      required: ['estado'],
      additionalProperties: false,
      properties: {
        estado: { type: 'string', enum: ESTADO_PLAN_SEGUIMIENTO_VALUES },
        motivo_cierre: { type: 'string', maxLength: 2000 },
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object', properties: { plan: planSeguimientoShape } },
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

const actividadBodyProps = {
  tipo: { type: 'string', enum: TIPO_INDICACION_SEGUIMIENTO_VALUES },
  descripcion: { type: 'string', minLength: 3, maxLength: 300 },
  fecha_programada: { type: 'string', format: 'date', nullable: true },
  fecha_limite: { type: 'string', format: 'date', nullable: true },
  dias_desde_inicio: { type: 'integer', nullable: true },
  instrucciones_paciente: { type: 'string', maxLength: 2000, nullable: true },
  requiere_preparacion: { type: 'boolean' },
  detalle_preparacion: { type: 'string', maxLength: 2000, nullable: true },
  numero_orden: { type: 'integer', minimum: 1 },
} as const;

export const crearActividadSchema = {
  schema: {
    tags: ['Seguimiento / Planes'],
    summary: 'Agregar actividad al plan (UC-SEG-003)',
    description:
      'Solo si el plan no está en estado terminal (`completado`/`cancelado`). `numero_orden` se ' +
      'autoasigna (siguiente correlativo) si se omite.',
    security: [{ bearerAuth: [] }],
    params: idParam,
    body: {
      type: 'object',
      required: ['tipo', 'descripcion'],
      additionalProperties: false,
      properties: actividadBodyProps,
    },
    response: {
      201: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object', properties: { actividad: actividadSeguimientoShape } },
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

export const listActividadesSchema = {
  schema: {
    tags: ['Seguimiento / Planes'],
    summary: 'Listar actividades del plan',
    security: [{ bearerAuth: [] }],
    params: idParam,
    querystring: {
      type: 'object',
      additionalProperties: false,
      properties: { estado: { type: 'string', enum: ESTADO_ACTIVIDAD_SEGUIMIENTO_VALUES } },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: { items: { type: 'array', items: actividadSeguimientoShape } },
          },
          meta: { type: 'object', properties: metaProperties },
        },
      },
      401: errorEnvelope,
      403: errorEnvelope,
      404: errorEnvelope,
    },
  },
} as const;

export const actualizarActividadSchema = {
  schema: {
    tags: ['Seguimiento / Planes'],
    summary: 'Actualizar actividad (fechas, instrucciones, resultado)',
    description:
      '`estado` restringido a: ' +
      `${ESTADOS_ACTIVIDAD_GESTIONABLES.join(', ')} (\`indicacion_creada\`/\`vencida\` son ` +
      'exclusivos del job diario). Marca automáticamente `gestionada_por`/`fecha_gestion` si se ' +
      'envía `estado`, `resultado_resumen` o `notas`. No permitido si el plan es terminal.',
    security: [{ bearerAuth: [] }],
    params: idParam,
    body: {
      type: 'object',
      additionalProperties: false,
      minProperties: 1,
      properties: {
        ...actividadBodyProps,
        estado: { type: 'string', enum: [...ESTADOS_ACTIVIDAD_GESTIONABLES] },
        resultado_resumen: { type: 'string', maxLength: 2000 },
        notas: { type: 'string', maxLength: 2000 },
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object', properties: { actividad: actividadSeguimientoShape } },
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

export const eliminarActividadSchema = {
  schema: {
    tags: ['Seguimiento / Planes'],
    summary: 'Eliminar actividad (soft delete)',
    description: 'No permitido si ya está `completada` o si el plan es terminal.',
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
      409: errorEnvelope,
    },
  },
} as const;

export const ejecutarPlanSeguimientoJobSchema = {
  schema: {
    tags: ['Seguimiento / Planes'],
    summary: 'Job diario: generar indicaciones automáticas y marcar actividades vencidas',
    description:
      'Uso exclusivo de cron externo (`X-Cron-Secret`). Para actividades `pendiente` cuya ' +
      '`fecha_programada` esté a ≤7 días, crea una `indicacion_seguimiento` (estado `pendiente`) y ' +
      'pasa la actividad a `indicacion_creada`. Marca `vencida` toda actividad `pendiente`/' +
      '`indicacion_creada` cuya `fecha_limite` (o `fecha_programada` si no hay límite) ya pasó.',
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
