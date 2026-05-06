import {
  GENERO_VALUES,
  GRUPO_SANGUINEO_VALUES,
  SEVERIDAD_ALERGIA_VALUES,
  Genero,
  GrupoSanguineo,
  SeveridadAlergia,
} from '../../core/enums/paciente.enums.js';

// Re-exportar enums para que los consumers del módulo puedan importarlos desde aquí
export { Genero, GrupoSanguineo, SeveridadAlergia };

// ─── Tipos TypeScript ────────────────────────────────────────────────────────

export type CreatePacienteInput = {
  nombre: string;
  apellido: string;
  dpi?: string;
  nit?: string;
  fecha_nacimiento?: string;
  genero?: Genero;
  telefono?: string;
  telefono_secundario?: string;
  email?: string;
  direccion?: string;
  /** UUID de fila en catálogo `municipio` del mismo tenant. */
  municipio_id?: string | null;
  contacto_emergencia_nombre?: string;
  contacto_emergencia_telefono?: string;
  contacto_emergencia_relacion?: string;
  grupo_sanguineo?: GrupoSanguineo;
  notas_globales?: string;
};

export type UpdatePacienteInput = Partial<CreatePacienteInput>;

export type SearchPacientesQuery = {
  q?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export type CreateAlergiaInput = {
  sustancia: string;
  tipo_reaccion?: string;
  severidad: SeveridadAlergia;
  notas?: string;
};

export type CreateSeguroInput = {
  aseguradora_id: string;
  numero_poliza: string;
  tipo_plan?: string;
  vigencia_inicio?: string;
  vigencia_fin?: string;
};

export type UpdateSeguroInput = {
  numero_poliza?: string;
  tipo_plan?: string;
  vigencia_inicio?: string;
  vigencia_fin?: string;
  activo?: boolean;
};

// ─── Schemas JSON (Fastify + OpenAPI) ────────────────────────────────────────

const pacienteBaseProperties = {
  nombre:        { type: 'string', minLength: 1, maxLength: 150 },
  apellido:      { type: 'string', minLength: 1, maxLength: 150 },
  dpi:           { type: 'string', pattern: '^\\d{13}$', description: 'CUI guatemalteco: 13 dígitos numéricos' },
  nit:           { type: 'string', maxLength: 20 },
  fecha_nacimiento:              { type: 'string', format: 'date' },
  genero:        { type: 'string', enum: GENERO_VALUES },
  telefono:      { type: 'string', maxLength: 30 },
  telefono_secundario:           { type: 'string', maxLength: 30 },
  email:         { type: 'string', format: 'email', maxLength: 200 },
  direccion:     { type: 'string' },
  municipio_id:  { type: 'string', format: 'uuid', description: 'Catálogo municipio (tenant).' },
  contacto_emergencia_nombre:   { type: 'string', maxLength: 150 },
  contacto_emergencia_telefono: { type: 'string', maxLength: 30 },
  contacto_emergencia_relacion: { type: 'string', maxLength: 50 },
  grupo_sanguineo:  { type: 'string', enum: GRUPO_SANGUINEO_VALUES },
  notas_globales:   { type: 'string' },
};

// Campos del paciente que devuelve la API (incluye id, timestamps y expediente)
const pacienteResponseProperties = {
  id:            { type: 'string', format: 'uuid' },
  nombre:        { type: 'string' },
  apellido:      { type: 'string' },
  dpi:           { type: 'string', nullable: true },
  nit:           { type: 'string', nullable: true },
  fecha_nacimiento: { type: 'string', nullable: true },
  genero:        { type: 'string', nullable: true },
  telefono:      { type: 'string', nullable: true },
  telefono_secundario:          { type: 'string', nullable: true },
  email:         { type: 'string', nullable: true },
  direccion:     { type: 'string', nullable: true },
  municipio_id:  { type: 'string', format: 'uuid', nullable: true },
  ubicacion: {
    type: 'object',
    nullable: true,
    description: 'Resumen desde catálogos municipio + departamento.',
    properties: {
      municipio: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          codigo: { type: 'string' },
          nombre: { type: 'string' },
        },
      },
      departamento: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          codigo: { type: 'string' },
          nombre: { type: 'string' },
        },
      },
    },
  },
  contacto_emergencia_nombre:   { type: 'string', nullable: true },
  contacto_emergencia_telefono: { type: 'string', nullable: true },
  contacto_emergencia_relacion: { type: 'string', nullable: true },
  grupo_sanguineo:  { type: 'string', nullable: true },
  notas_globales:   { type: 'string', nullable: true },
  activo:        { type: 'boolean', nullable: true },
  deleted:       { type: 'boolean', nullable: true },
  created_at:    { type: 'string', nullable: true },
  updated_at:    { type: 'string', nullable: true },
  expediente: {
    type: 'object',
    nullable: true,
    properties: {
      numero_expediente: { type: 'string' },
      fecha_registro:    { type: 'string', nullable: true },
      activo:            { type: 'boolean', nullable: true },
    },
  },
} as const;

const metaProperties = {
  requestId: { type: 'string' },
} as const;

export const crearPacienteSchema = {
  schema: {
    tags: ['Pacientes'],
    summary: 'Registrar nuevo paciente',
    security: [{ bearerAuth: [] }],
    body: {
      type: 'object',
      required: ['nombre', 'apellido'],
      additionalProperties: false,
      properties: pacienteBaseProperties,
    },
    response: {
      201: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data:    { type: 'object', properties: pacienteResponseProperties },
          meta:    { type: 'object', properties: metaProperties },
        },
      },
    },
  },
} as const;

export const actualizarPacienteSchema = {
  schema: {
    tags: ['Pacientes'],
    summary: 'Actualizar datos del paciente',
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', format: 'uuid' } },
    },
    body: {
      type: 'object',
      additionalProperties: false,
      properties: pacienteBaseProperties,
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data:    { type: 'object', properties: pacienteResponseProperties },
          meta:    { type: 'object', properties: metaProperties },
        },
      },
    },
  },
} as const;

export const buscarPacientesSchema = {
  schema: {
    tags: ['Pacientes'],
    summary: 'Buscar pacientes del tenant',
    security: [{ bearerAuth: [] }],
    querystring: {
      type: 'object',
      properties: {
        q:         { type: 'string', description: 'Búsqueda por nombre, apellido, DPI, NIT o teléfono' },
        page:      { type: 'integer', minimum: 1, default: 1 },
        pageSize:  { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        sortBy:    { type: 'string', default: 'created_at' },
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
              items: {
                type: 'array',
                items: { type: 'object', properties: pacienteResponseProperties },
              },
              pagination: {
                type: 'object',
                properties: {
                  page:       { type: 'integer' },
                  pageSize:   { type: 'integer' },
                  total:      { type: 'integer' },
                  totalPages: { type: 'integer' },
                },
              },
              sort: {
                type: 'object',
                properties: {
                  sortBy:    { type: 'string' },
                  sortOrder: { type: 'string' },
                },
              },
              filters: {
                type: 'object',
                properties: {
                  q: { type: 'string', nullable: true },
                },
              },
            },
          },
          meta: { type: 'object', properties: metaProperties },
        },
      },
    },
  },
} as const;

export const obtenerPacienteSchema = {
  schema: {
    tags: ['Pacientes'],
    summary: 'Obtener paciente por ID',
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', format: 'uuid' } },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data:    { type: 'object', properties: pacienteResponseProperties },
          meta:    { type: 'object', properties: metaProperties },
        },
      },
    },
  },
} as const;

export const perfilPacienteSchema = {
  schema: {
    tags: ['Pacientes'],
    summary: 'Perfil completo del paciente (datos + alergias + seguros + historial)',
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', format: 'uuid' } },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              ...pacienteResponseProperties,
              alergias: { type: 'array', items: { type: 'object', additionalProperties: true } },
              seguros:  { type: 'array', items: { type: 'object', additionalProperties: true } },
              ultimos_encuentros: { type: 'array', items: { type: 'object', additionalProperties: true } },
              planes_activos:     { type: 'array', items: { type: 'object', additionalProperties: true } },
            },
          },
          meta: { type: 'object', properties: metaProperties },
        },
      },
    },
  },
} as const;

export const eliminarPacienteSchema = {
  schema: {
    tags: ['Pacientes'],
    summary: 'Eliminar paciente (soft delete)',
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', format: 'uuid' } },
    },
  },
} as const;

// ─── Alergias ────────────────────────────────────────────────────────────────

export const crearAlergiaSchema = {
  schema: {
    tags: ['Pacientes / Alergias'],
    summary: 'Agregar alergia al paciente',
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', format: 'uuid' } },
    },
    body: {
      type: 'object',
      required: ['sustancia', 'severidad'],
      additionalProperties: false,
      properties: {
        sustancia:     { type: 'string', minLength: 1, maxLength: 200 },
        tipo_reaccion: { type: 'string', maxLength: 100 },
        severidad:     { type: 'string', enum: SEVERIDAD_ALERGIA_VALUES },
        notas:         { type: 'string' },
      },
    },
    response: {
      201: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              id:            { type: 'string', format: 'uuid' },
              paciente_id:   { type: 'string', format: 'uuid' },
              sustancia:     { type: 'string' },
              tipo_reaccion: { type: 'string', nullable: true },
              severidad:     { type: 'string' },
              notas:         { type: 'string', nullable: true },
              activo:        { type: 'boolean', nullable: true },
              created_at:    { type: 'string', nullable: true },
            },
          },
          meta: { type: 'object', properties: metaProperties },
        },
      },
    },
  },
} as const;

export const listarAlergiasSchema = {
  schema: {
    tags: ['Pacientes / Alergias'],
    summary: 'Listar alergias del paciente',
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', format: 'uuid' } },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id:            { type: 'string', format: 'uuid' },
                    paciente_id:   { type: 'string', format: 'uuid' },
                    sustancia:     { type: 'string' },
                    tipo_reaccion: { type: 'string', nullable: true },
                    severidad:     { type: 'string' },
                    notas:         { type: 'string', nullable: true },
                    activo:        { type: 'boolean', nullable: true },
                    created_at:    { type: 'string', nullable: true },
                  },
                },
              },
            },
          },
          meta: { type: 'object', properties: metaProperties },
        },
      },
    },
  },
} as const;

export const eliminarAlergiaSchema = {
  schema: {
    tags: ['Pacientes / Alergias'],
    summary: 'Eliminar alergia del paciente',
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['id', 'alergiaId'],
      properties: {
        id:        { type: 'string', format: 'uuid' },
        alergiaId: { type: 'string', format: 'uuid' },
      },
    },
  },
} as const;

// ─── Seguros ─────────────────────────────────────────────────────────────────

export const crearSeguroSchema = {
  schema: {
    tags: ['Pacientes / Seguros'],
    summary: 'Agregar seguro al paciente',
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', format: 'uuid' } },
    },
    body: {
      type: 'object',
      required: ['aseguradora_id', 'numero_poliza'],
      additionalProperties: false,
      properties: {
        aseguradora_id:  { type: 'string', format: 'uuid' },
        numero_poliza:   { type: 'string', minLength: 1, maxLength: 80 },
        tipo_plan:       { type: 'string', maxLength: 100 },
        vigencia_inicio: { type: 'string', format: 'date' },
        vigencia_fin:    { type: 'string', format: 'date' },
      },
    },
    response: {
      201: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              id:              { type: 'string', format: 'uuid' },
              paciente_id:     { type: 'string', format: 'uuid' },
              aseguradora_id:  { type: 'string', format: 'uuid' },
              numero_poliza:   { type: 'string' },
              tipo_plan:       { type: 'string', nullable: true },
              vigencia_inicio: { type: 'string', nullable: true },
              vigencia_fin:    { type: 'string', nullable: true },
              activo:          { type: 'boolean', nullable: true },
              created_at:      { type: 'string', nullable: true },
              aseguradora: {
                type: 'object',
                nullable: true,
                properties: {
                  id:     { type: 'string', format: 'uuid' },
                  nombre: { type: 'string' },
                },
              },
            },
          },
          meta: { type: 'object', properties: metaProperties },
        },
      },
    },
  },
} as const;

export const listarSegurosSchema = {
  schema: {
    tags: ['Pacientes / Seguros'],
    summary: 'Listar seguros del paciente',
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', format: 'uuid' } },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id:              { type: 'string', format: 'uuid' },
                    paciente_id:     { type: 'string', format: 'uuid' },
                    aseguradora_id:  { type: 'string', format: 'uuid' },
                    numero_poliza:   { type: 'string' },
                    tipo_plan:       { type: 'string', nullable: true },
                    vigencia_inicio: { type: 'string', nullable: true },
                    vigencia_fin:    { type: 'string', nullable: true },
                    activo:          { type: 'boolean', nullable: true },
                    created_at:      { type: 'string', nullable: true },
                    aseguradora: {
                      type: 'object',
                      nullable: true,
                      properties: {
                        id:     { type: 'string', format: 'uuid' },
                        nombre: { type: 'string' },
                        nit:    { type: 'string', nullable: true },
                      },
                    },
                  },
                },
              },
            },
          },
          meta: { type: 'object', properties: metaProperties },
        },
      },
    },
  },
} as const;

export const actualizarSeguroSchema = {
  schema: {
    tags: ['Pacientes / Seguros'],
    summary: 'Actualizar seguro del paciente',
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['id', 'seguroId'],
      properties: {
        id:       { type: 'string', format: 'uuid' },
        seguroId: { type: 'string', format: 'uuid' },
      },
    },
    body: {
      type: 'object',
      additionalProperties: false,
      properties: {
        numero_poliza:   { type: 'string', minLength: 1, maxLength: 80 },
        tipo_plan:       { type: 'string', maxLength: 100 },
        vigencia_inicio: { type: 'string', format: 'date' },
        vigencia_fin:    { type: 'string', format: 'date' },
        activo:          { type: 'boolean' },
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
              id:              { type: 'string', format: 'uuid' },
              paciente_id:     { type: 'string', format: 'uuid' },
              aseguradora_id:  { type: 'string', format: 'uuid' },
              numero_poliza:   { type: 'string' },
              tipo_plan:       { type: 'string', nullable: true },
              vigencia_inicio: { type: 'string', nullable: true },
              vigencia_fin:    { type: 'string', nullable: true },
              activo:          { type: 'boolean', nullable: true },
              created_at:      { type: 'string', nullable: true },
              aseguradora: {
                type: 'object',
                nullable: true,
                properties: {
                  id:     { type: 'string', format: 'uuid' },
                  nombre: { type: 'string' },
                },
              },
            },
          },
          meta: { type: 'object', properties: metaProperties },
        },
      },
    },
  },
} as const;

export const eliminarSeguroSchema = {
  schema: {
    tags: ['Pacientes / Seguros'],
    summary: 'Eliminar seguro del paciente',
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['id', 'seguroId'],
      properties: {
        id:       { type: 'string', format: 'uuid' },
        seguroId: { type: 'string', format: 'uuid' },
      },
    },
    response: { 204: { type: 'null' } },
  },
} as const;
