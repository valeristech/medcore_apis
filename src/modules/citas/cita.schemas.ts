export type CreateCitaInput = {
  paciente_id: string;
  usuario_id: string;
  consultorio_id: string;
  sede_id: string;
  tipo_cita_id: string;
  /** ISO-8601 (UTC o con offset). Fin se calcula con `tipo_cita.duracion_minutos` salvo `fecha_hora_fin`. */
  fecha_hora_inicio: string;
  fecha_hora_fin?: string;
  notas?: string;
  origen?: string;
  /** IANA para validar disponibilidad (default: `organizacion.zona_horaria` o `America/Guatemala`). */
  timezone?: string;
};

export type RescheduleCitaInput = {
  paciente_id?: string;
  usuario_id?: string;
  consultorio_id?: string;
  sede_id?: string;
  tipo_cita_id?: string;
  fecha_hora_inicio?: string;
  fecha_hora_fin?: string;
  notas?: string;
  timezone?: string;
};

export type CancelCitaInput = {
  motivo_cancelacion: string;
};

export type MarkNoShowInput = {
  notas?: string;
  /** Default `true`: crea `alerta_preventiva` para seguimiento. */
  crear_alerta?: boolean;
  prioridad_alerta?: 'baja' | 'normal' | 'alta' | 'critica';
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

const citaShape = {
  type: 'object',
  required: [
    'id',
    'paciente_id',
    'usuario_id',
    'consultorio_id',
    'sede_id',
    'tipo_cita_id',
    'fecha_hora_inicio',
    'fecha_hora_fin',
    'estado',
  ],
  properties: {
    id: { type: 'string', format: 'uuid' },
    paciente_id: { type: 'string', format: 'uuid' },
    usuario_id: { type: 'string', format: 'uuid' },
    consultorio_id: { type: 'string', format: 'uuid' },
    sede_id: { type: 'string', format: 'uuid' },
    tipo_cita_id: { type: 'string', format: 'uuid' },
    fecha_hora_inicio: { type: 'string', format: 'date-time' },
    fecha_hora_fin: { type: 'string', format: 'date-time' },
    estado: { type: 'string' },
    motivo_cancelacion: { type: 'string', nullable: true },
    notas: { type: 'string', nullable: true },
    origen: { type: 'string', nullable: true },
    created_at: { type: 'string', nullable: true },
    paciente: {
      type: 'object',
      nullable: true,
      properties: {
        id: { type: 'string', format: 'uuid' },
        nombre: { type: 'string' },
        apellido: { type: 'string' },
      },
    },
    usuario: {
      type: 'object',
      nullable: true,
      properties: {
        id: { type: 'string', format: 'uuid' },
        nombre: { type: 'string' },
        apellido: { type: 'string' },
        especialidad: { type: 'string', nullable: true },
      },
    },
    consultorio: {
      type: 'object',
      nullable: true,
      properties: {
        id: { type: 'string', format: 'uuid' },
        nombre: { type: 'string' },
        sede_id: { type: 'string', format: 'uuid' },
      },
    },
    sede: {
      type: 'object',
      nullable: true,
      properties: {
        id: { type: 'string', format: 'uuid' },
        nombre: { type: 'string' },
      },
    },
    tipo_cita: {
      type: 'object',
      nullable: true,
      properties: {
        id: { type: 'string', format: 'uuid' },
        nombre: { type: 'string' },
        duracion_minutos: { type: 'integer' },
        color: { type: 'string', nullable: true },
      },
    },
  },
} as const;

const idParam = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;

const citaSlotBodyProps = {
  paciente_id: { type: 'string', format: 'uuid' },
  usuario_id: { type: 'string', format: 'uuid', description: 'Médico / usuario que atiende.' },
  consultorio_id: { type: 'string', format: 'uuid' },
  sede_id: { type: 'string', format: 'uuid' },
  tipo_cita_id: { type: 'string', format: 'uuid' },
  fecha_hora_inicio: { type: 'string', format: 'date-time' },
  fecha_hora_fin: {
    type: 'string',
    format: 'date-time',
    description: 'Opcional; si se omite se usa `duracion_minutos` del tipo de cita.',
  },
  notas: { type: 'string' },
  timezone: {
    type: 'string',
    description: 'Zona IANA para validar disponibilidad (p. ej. America/Guatemala).',
  },
} as const;

const listaEsperaSugerenciaShape = {
  type: 'object',
  required: ['total', 'items'],
  properties: {
    total: { type: 'integer' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          paciente_id: { type: 'string', format: 'uuid' },
          paciente: {
            type: 'object',
            nullable: true,
            properties: {
              id: { type: 'string', format: 'uuid' },
              nombre: { type: 'string' },
              apellido: { type: 'string' },
              telefono: { type: 'string', nullable: true },
            },
          },
          tipo_cita_id: { type: 'string', format: 'uuid', nullable: true },
          tipo_cita: {
            type: 'object',
            nullable: true,
            properties: {
              id: { type: 'string', format: 'uuid' },
              nombre: { type: 'string' },
            },
          },
          usuario_id: { type: 'string', format: 'uuid', nullable: true },
          fecha_desde: { type: 'string', nullable: true },
          fecha_hasta: { type: 'string', nullable: true },
          notas: { type: 'string', nullable: true },
        },
      },
    },
  },
} as const;

export const crearCitaSchema = {
  schema: {
    tags: ['Agenda / Citas'],
    summary: 'Crear cita (validaciones, conflictos, tipo cita y sede)',
    description:
      'Valida tenant (paciente, médico, sede, consultorio, tipo de cita), coherencia sede–consultorio, solapamientos con otras citas activas y que el horario caiga dentro de las reglas de disponibilidad del médico en ese consultorio.',
    security: [{ bearerAuth: [] }],
    body: {
      type: 'object',
      required: [
        'paciente_id',
        'usuario_id',
        'consultorio_id',
        'sede_id',
        'tipo_cita_id',
        'fecha_hora_inicio',
      ],
      additionalProperties: false,
      properties: {
        ...citaSlotBodyProps,
        origen: { type: 'string', maxLength: 20, description: 'Default: manual.' },
      },
    },
    response: {
      201: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object', properties: { cita: citaShape } },
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

export const reagendarCitaSchema = {
  schema: {
    tags: ['Agenda / Citas'],
    summary: 'Reagendar cita',
    description:
      'Mueve la cita a otro horario y/o cambia médico, consultorio, sede o tipo. Revalida conflictos y disponibilidad (excluye la propia cita). Solo estados `programada` o `confirmada`.',
    security: [{ bearerAuth: [] }],
    params: idParam,
    body: {
      type: 'object',
      additionalProperties: false,
      minProperties: 1,
      properties: citaSlotBodyProps,
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object', properties: { cita: citaShape } },
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

export const cancelarCitaSchema = {
  schema: {
    tags: ['Agenda / Citas'],
    summary: 'Cancelar cita',
    description:
      'Marca la cita como `cancelada` con motivo obligatorio. Si hay pacientes en lista de espera para el mismo médico/tipo, devuelve sugerencias para ofrecer el slot liberado.',
    security: [{ bearerAuth: [] }],
    params: idParam,
    body: {
      type: 'object',
      required: ['motivo_cancelacion'],
      additionalProperties: false,
      properties: {
        motivo_cancelacion: { type: 'string', minLength: 3, maxLength: 2000 },
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            required: ['cita'],
            properties: {
              cita: citaShape,
              lista_espera: { ...listaEsperaSugerenciaShape, nullable: true },
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

const alertaResumenShape = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    titulo: { type: 'string' },
    tipo: { type: 'string' },
    prioridad: { type: 'string', nullable: true },
  },
} as const;

export const marcarNoShowCitaSchema = {
  schema: {
    tags: ['Agenda / Citas'],
    summary: 'Marcar cita como no-show (no asistió)',
    description:
      'Marca la cita como `no_asistio` si ya pasó su hora de inicio y estaba `programada` o `confirmada`. Opcionalmente crea `alerta_preventiva` para seguimiento.',
    security: [{ bearerAuth: [] }],
    params: idParam,
    body: {
      type: 'object',
      additionalProperties: false,
      properties: {
        notas: { type: 'string', maxLength: 2000, description: 'Observación de la secretaría.' },
        crear_alerta: { type: 'boolean', default: true },
        prioridad_alerta: {
          type: 'string',
          enum: ['baja', 'normal', 'alta', 'critica'],
          default: 'normal',
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
            required: ['cita'],
            properties: {
              cita: citaShape,
              alerta: { ...alertaResumenShape, nullable: true },
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
