import {
  Genero,
  GENERO_VALUES,
  GRUPO_SANGUINEO_VALUES,
  GrupoSanguineo,
  SEVERIDAD_ALERGIA_VALUES,
  SeveridadAlergia,
} from "../../core/enums/paciente.enums.js";
import {
  TIPO_ENCUENTRO_VALUES,
  ESTADO_ENCUENTRO_VALUES,
  TIPO_DIAGNOSTICO_VALUES,
  ESTADO_PRESCRIPCION_VALUES,
  TIPO_ESTUDIO_VALUES,
  ESTADO_ESTUDIO_VALUES,
  TIPO_EVOLUCION_VALUES,
  TIPO_FIRMA_VALUES,
} from "../../core/enums/hce.enums.js";

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
  sortOrder?: "asc" | "desc";
};

export const PACIENTE_SORT_BY_VALUES = [
  "created_at",
  "updated_at",
  "nombre",
  "apellido",
  "dpi",
  "nit",
] as const;

export type PacienteSortBy = (typeof PACIENTE_SORT_BY_VALUES)[number];

export type CreateAlergiaInput = {
  sustancia: string;
  tipo_reaccion?: string;
  severidad: SeveridadAlergia;
  notas?: string;
};

export type UpdateAlergiaInput = {
  sustancia?: string;
  tipo_reaccion?: string;
  severidad?: SeveridadAlergia;
  notas?: string;
  activo?: boolean;
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

export const SEGURO_SORT_BY_VALUES = [
  "created_at",
  "vigencia_inicio",
] as const;
export type SeguroSortBy = (typeof SEGURO_SORT_BY_VALUES)[number];

export type SearchSegurosQuery = {
  activo?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: SeguroSortBy;
  sortOrder?: "asc" | "desc";
};

export type HistorialPacienteQuery = {
  page?: number;
  pageSize?: number;
  sortOrder?: "asc" | "desc";
};

// ─── Schemas JSON (Fastify + OpenAPI) ────────────────────────────────────────

const pacienteBaseProperties = {
  nombre: { type: "string", minLength: 1, maxLength: 150 },
  apellido: { type: "string", minLength: 1, maxLength: 150 },
  dpi: {
    type: "string",
    pattern: "^\\d{13}$",
    description: "CUI guatemalteco: 13 dígitos numéricos",
  },
  nit: { type: "string", maxLength: 20 },
  fecha_nacimiento: { type: "string", format: "date" },
  genero: { type: "string", enum: GENERO_VALUES },
  telefono: { type: "string", maxLength: 30 },
  telefono_secundario: { type: "string", maxLength: 30 },
  email: { type: "string", format: "email", maxLength: 200 },
  direccion: { type: "string" },
  municipio_id: {
    type: "string",
    format: "uuid",
    description: "Catálogo municipio (tenant).",
  },
  contacto_emergencia_nombre: { type: "string", maxLength: 150 },
  contacto_emergencia_telefono: { type: "string", maxLength: 30 },
  contacto_emergencia_relacion: { type: "string", maxLength: 50 },
  grupo_sanguineo: { type: "string", enum: GRUPO_SANGUINEO_VALUES },
  notas_globales: { type: "string" },
};

// Campos del paciente que devuelve la API (incluye id, timestamps y expediente)
const pacienteResponseProperties = {
  id: { type: "string", format: "uuid" },
  nombre: { type: "string" },
  apellido: { type: "string" },
  dpi: { type: "string", nullable: true },
  nit: { type: "string", nullable: true },
  fecha_nacimiento: { type: "string", nullable: true },
  genero: { type: "string", nullable: true },
  telefono: { type: "string", nullable: true },
  telefono_secundario: { type: "string", nullable: true },
  email: { type: "string", nullable: true },
  direccion: { type: "string", nullable: true },
  municipio_id: { type: "string", format: "uuid", nullable: true },
  ubicacion: {
    type: "object",
    nullable: true,
    description: "Resumen desde catálogos municipio + departamento.",
    properties: {
      municipio: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          codigo: { type: "string" },
          nombre: { type: "string" },
        },
      },
      departamento: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          codigo: { type: "string" },
          nombre: { type: "string" },
        },
      },
    },
  },
  contacto_emergencia_nombre: { type: "string", nullable: true },
  contacto_emergencia_telefono: { type: "string", nullable: true },
  contacto_emergencia_relacion: { type: "string", nullable: true },
  grupo_sanguineo: { type: "string", nullable: true },
  notas_globales: { type: "string", nullable: true },
  activo: { type: "boolean", nullable: true },
  deleted: { type: "boolean", nullable: true },
  created_at: { type: "string", nullable: true },
  updated_at: { type: "string", nullable: true },
  expediente: {
    type: "object",
    nullable: true,
    properties: {
      numero_expediente: { type: "string" },
      fecha_registro: { type: "string", nullable: true },
      activo: { type: "boolean", nullable: true },
    },
  },
} as const;

const metaProperties = {
  requestId: { type: "string" },
} as const;

export const crearPacienteSchema = {
  schema: {
    tags: ["Pacientes"],
    summary: "Registrar nuevo paciente",
    security: [{ bearerAuth: [] }],
    body: {
      type: "object",
      required: ["nombre", "apellido"],
      additionalProperties: false,
      properties: pacienteBaseProperties,
    },
    response: {
      201: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: { type: "object", properties: pacienteResponseProperties },
          meta: { type: "object", properties: metaProperties },
        },
      },
    },
  },
} as const;

export const actualizarPacienteSchema = {
  schema: {
    tags: ["Pacientes"],
    summary: "Actualizar datos del paciente",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object",
      required: ["id"],
      properties: { id: { type: "string", format: "uuid" } },
    },
    body: {
      type: "object",
      additionalProperties: false,
      properties: pacienteBaseProperties,
    },
    response: {
      200: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: { type: "object", properties: pacienteResponseProperties },
          meta: { type: "object", properties: metaProperties },
        },
      },
    },
  },
} as const;

export const buscarPacientesSchema = {
  schema: {
    tags: ["Pacientes"],
    summary: "Buscar pacientes del tenant",
    security: [{ bearerAuth: [] }],
    querystring: {
      type: "object",
      properties: {
        q: {
          type: "string",
          description: "Búsqueda por nombre, apellido, DPI, NIT o teléfono",
        },
        page: { type: "integer", minimum: 1, default: 1 },
        pageSize: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        sortBy: {
          type: "string",
          enum: PACIENTE_SORT_BY_VALUES,
          default: "created_at",
        },
        sortOrder: { type: "string", enum: ["asc", "desc"], default: "desc" },
      },
    },
    response: {
      200: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: pacienteResponseProperties,
                },
              },
              pagination: {
                type: "object",
                properties: {
                  page: { type: "integer" },
                  pageSize: { type: "integer" },
                  total: { type: "integer" },
                  totalPages: { type: "integer" },
                },
              },
              sort: {
                type: "object",
                properties: {
                  sortBy: { type: "string" },
                  sortOrder: { type: "string" },
                },
              },
              filters: {
                type: "object",
                properties: {
                  q: { type: "string", nullable: true },
                },
              },
            },
          },
          meta: { type: "object", properties: metaProperties },
        },
      },
    },
  },
} as const;

export const obtenerPacienteSchema = {
  schema: {
    tags: ["Pacientes"],
    summary: "Obtener paciente por ID",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object",
      required: ["id"],
      properties: { id: { type: "string", format: "uuid" } },
    },
    response: {
      200: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: { type: "object", properties: pacienteResponseProperties },
          meta: { type: "object", properties: metaProperties },
        },
      },
    },
  },
} as const;

export const perfilPacienteSchema = {
  schema: {
    tags: ["Pacientes"],
    summary:
      "Perfil completo del paciente (datos + alergias + seguros + historial)",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object",
      required: ["id"],
      properties: { id: { type: "string", format: "uuid" } },
    },
    response: {
      200: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              ...pacienteResponseProperties,
              alergias: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    paciente_id: { type: "string", format: "uuid" },
                    sustancia: { type: "string" },
                    tipo_reaccion: { type: "string", nullable: true },
                    severidad: { type: "string" },
                    notas: { type: "string", nullable: true },
                    activo: { type: "boolean", nullable: true },
                    created_at: { type: "string", nullable: true },
                  },
                },
              },
              seguros: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    paciente_id: { type: "string", format: "uuid" },
                    aseguradora_id: { type: "string", format: "uuid" },
                    numero_poliza: { type: "string" },
                    tipo_plan: { type: "string", nullable: true },
                    vigencia_inicio: { type: "string", nullable: true },
                    vigencia_fin: { type: "string", nullable: true },
                    activo: { type: "boolean", nullable: true },
                    created_at: { type: "string", nullable: true },
                    aseguradora: {
                      type: "object",
                      nullable: true,
                      properties: {
                        id: { type: "string", format: "uuid" },
                        nombre: { type: "string" },
                        nit: { type: "string", nullable: true },
                      },
                    },
                  },
                },
              },
              ultimos_encuentros: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    fecha: { type: "string", nullable: true },
                    tipo: { type: "string", nullable: true },
                    estado: { type: "string", nullable: true },
                    motivo_consulta: { type: "string", nullable: true },
                    usuario: {
                      type: "object",
                      nullable: true,
                      properties: {
                        id: { type: "string", format: "uuid" },
                        nombre: { type: "string", nullable: true },
                        apellido: { type: "string", nullable: true },
                        especialidad: { type: "string", nullable: true },
                      },
                    },
                    sede: {
                      type: "object",
                      nullable: true,
                      properties: {
                        id: { type: "string", format: "uuid" },
                        nombre: { type: "string" },
                      },
                    },
                  },
                },
              },
              planes_activos: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    nombre: { type: "string" },
                    estado: { type: "string", nullable: true },
                    fecha_inicio: { type: "string", nullable: true },
                    fecha_fin_estimada: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
          meta: { type: "object", properties: metaProperties },
        },
      },
    },
  },
} as const;

// ─── Historial clínico (UC-HCE-007) ─────────────────────────────────────────

const autorHistorialShape = {
  type: "object",
  nullable: true,
  properties: {
    id: { type: "string", format: "uuid" },
    nombre: { type: "string", nullable: true },
    apellido: { type: "string", nullable: true },
  },
} as const;

const diagnosticoHistorialShape = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    codigo_icd10: { type: "string" },
    descripcion: { type: "string" },
    tipo: { type: "string", enum: TIPO_DIAGNOSTICO_VALUES },
    notas: { type: "string", nullable: true },
  },
} as const;

const notaHistorialShape = {
  type: "object",
  nullable: true,
  description: "Nota clínica del encuentro (null si aún no se escribió).",
  properties: {
    id: { type: "string", format: "uuid" },
    motivo_consulta: { type: "string", nullable: true },
    enfermedad_actual: { type: "string", nullable: true },
    antecedentes: { type: "string", nullable: true },
    examen_fisico: { type: "string", nullable: true },
    impresion_diagnostica: { type: "string", nullable: true },
    plan_tratamiento: { type: "string", nullable: true },
    estudios_solicitados_texto: { type: "string", nullable: true },
    recomendaciones: { type: "string", nullable: true },
    datos_adicionales: { type: "object", nullable: true },
    diagnosticos: { type: "array", items: diagnosticoHistorialShape },
  },
} as const;

const prescripcionHistorialShape = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    medicamento: { type: "string" },
    principio_activo: { type: "string", nullable: true },
    dosis: { type: "string" },
    via: { type: "string", nullable: true },
    frecuencia: { type: "string" },
    duracion: { type: "string", nullable: true },
    cantidad: { type: "integer", nullable: true },
    indicaciones: { type: "string", nullable: true },
    estado: { type: "string", enum: ESTADO_PRESCRIPCION_VALUES },
    created_at: { type: "string", nullable: true },
  },
} as const;

const estudioHistorialShape = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    tipo: { type: "string", enum: TIPO_ESTUDIO_VALUES },
    nombre: { type: "string" },
    descripcion: { type: "string", nullable: true },
    urgente: { type: "boolean", nullable: true },
    estado: { type: "string", enum: ESTADO_ESTUDIO_VALUES },
    resultado_texto: { type: "string", nullable: true },
    fecha_resultado: { type: "string", nullable: true },
    created_at: { type: "string", nullable: true },
  },
} as const;

const evolucionHistorialShape = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    nota: { type: "string" },
    tipo: { type: "string", enum: TIPO_EVOLUCION_VALUES },
    fecha: { type: "string", nullable: true },
    autor: autorHistorialShape,
  },
} as const;

const firmaHistorialShape = {
  type: "object",
  nullable: true,
  description: "Firma electrónica del encuentro (null si aún no está firmado).",
  properties: {
    id: { type: "string", format: "uuid" },
    tipo: { type: "string", enum: TIPO_FIRMA_VALUES },
    hash_documento: { type: "string", nullable: true },
    fecha_firma: { type: "string", nullable: true },
    autor: autorHistorialShape,
  },
} as const;

const encuentroHistorialShape = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    tipo: { type: "string", enum: TIPO_ENCUENTRO_VALUES },
    estado: { type: "string", enum: ESTADO_ENCUENTRO_VALUES },
    motivo_consulta: { type: "string", nullable: true },
    fecha: { type: "string", nullable: true },
    medico: autorHistorialShape,
    sede: {
      type: "object",
      nullable: true,
      properties: {
        id: { type: "string", format: "uuid" },
        nombre: { type: "string" },
      },
    },
    nota: notaHistorialShape,
    prescripciones: { type: "array", items: prescripcionHistorialShape },
    estudios: { type: "array", items: estudioHistorialShape },
    evoluciones: { type: "array", items: evolucionHistorialShape },
    firma: firmaHistorialShape,
  },
} as const;

export const historialPacienteSchema = {
  schema: {
    tags: ["Pacientes / Historial"],
    summary: "Historial clínico completo del paciente (UC-HCE-007)",
    description:
      "Agrega por encuentro: nota clínica + diagnósticos, prescripciones, estudios " +
      "solicitados, evoluciones y firma. Va más allá de las tablas listadas en el caso " +
      "de uso (encuentro, nota_clinica, diagnostico, prescripcion, estudio_solicitado) " +
      "para incluir también evolución y firma — omitirlas habría dejado el historial " +
      "incompleto. Paginado por encuentro (más reciente primero por defecto). " +
      "Acceso auditado por ser dato clínico sensible.",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object",
      required: ["id"],
      properties: { id: { type: "string", format: "uuid" } },
    },
    querystring: {
      type: "object",
      properties: {
        page: { type: "integer", minimum: 1, default: 1 },
        pageSize: { type: "integer", minimum: 1, maximum: 50, default: 10 },
        sortOrder: { type: "string", enum: ["asc", "desc"], default: "desc" },
      },
    },
    response: {
      200: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              items: { type: "array", items: encuentroHistorialShape },
              pagination: {
                type: "object",
                properties: {
                  page: { type: "integer" },
                  pageSize: { type: "integer" },
                  total: { type: "integer" },
                  totalPages: { type: "integer" },
                },
              },
              sort: {
                type: "object",
                properties: { sortOrder: { type: "string" } },
              },
            },
          },
          meta: { type: "object", properties: metaProperties },
        },
      },
    },
  },
} as const;

export const eliminarPacienteSchema = {
  schema: {
    tags: ["Pacientes"],
    summary: "Eliminar paciente (soft delete)",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object",
      required: ["id"],
      properties: { id: { type: "string", format: "uuid" } },
    },
  },
} as const;

// ─── Alergias ────────────────────────────────────────────────────────────────

export const crearAlergiaSchema = {
  schema: {
    tags: ["Pacientes / Alergias"],
    summary: "Agregar alergia al paciente",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object",
      required: ["id"],
      properties: { id: { type: "string", format: "uuid" } },
    },
    body: {
      type: "object",
      required: ["sustancia", "severidad"],
      additionalProperties: false,
      properties: {
        sustancia: { type: "string", minLength: 1, maxLength: 200 },
        tipo_reaccion: { type: "string", maxLength: 100 },
        severidad: { type: "string", enum: SEVERIDAD_ALERGIA_VALUES },
        notas: { type: "string" },
      },
    },

    response: {
      201: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              paciente_id: { type: "string", format: "uuid" },
              sustancia: { type: "string" },
              tipo_reaccion: { type: "string", nullable: true },
              severidad: { type: "string" },
              notas: { type: "string", nullable: true },
              activo: { type: "boolean", nullable: true },
              created_at: { type: "string", nullable: true },
            },
          },
          meta: { type: "object", properties: metaProperties },
        },
      },
    },
  },
} as const;

export const listarAlergiasSchema = {
  schema: {
    tags: ["Pacientes / Alergias"],
    summary: "Listar alergias del paciente",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object",
      required: ["id"],
      properties: { id: { type: "string", format: "uuid" } },
    },
    response: {
      200: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    paciente_id: { type: "string", format: "uuid" },
                    sustancia: { type: "string" },
                    tipo_reaccion: { type: "string", nullable: true },
                    severidad: { type: "string" },
                    notas: { type: "string", nullable: true },
                    activo: { type: "boolean", nullable: true },
                    created_at: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
          meta: { type: "object", properties: metaProperties },
        },
      },
    },
  },
} as const;

export const eliminarAlergiaSchema = {
  schema: {
    tags: ["Pacientes / Alergias"],
    summary: "Eliminar alergia del paciente",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object",
      required: ["id", "alergiaId"],
      properties: {
        id: { type: "string", format: "uuid" },
        alergiaId: { type: "string", format: "uuid" },
      },
    },
  },
} as const;

export const obtenerAlergiaSchema = {
  schema: {
    tags: ["Pacientes / Alergias"],
    summary: "Obtener alergia por ID",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object",
      required: ["id", "alergiaId"],
      properties: {
        id: { type: "string", format: "uuid" },
        alergiaId: { type: "string", format: "uuid" },
      },
    },
    response: {
      200: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              paciente_id: { type: "string", format: "uuid" },
              sustancia: { type: "string" },
              tipo_reaccion: { type: "string", nullable: true },
              severidad: { type: "string" },
              notas: { type: "string", nullable: true },
              activo: { type: "boolean", nullable: true },
              created_at: { type: "string", nullable: true },
            },
          },
          meta: { type: "object", properties: metaProperties },
        },
      },
    },
  },
} as const;

export const actualizarAlergiaSchema = {
  schema: {
    tags: ["Pacientes / Alergias"],
    summary: "Actualizar alergia del paciente",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object",
      required: ["id", "alergiaId"],
      properties: {
        id: { type: "string", format: "uuid" },
        alergiaId: { type: "string", format: "uuid" },
      },
    },
    body: {
      type: "object",
      additionalProperties: false,
      properties: {
        sustancia: { type: "string", minLength: 1, maxLength: 200 },
        tipo_reaccion: { type: "string", maxLength: 100 },
        severidad: { type: "string", enum: SEVERIDAD_ALERGIA_VALUES },
        notas: { type: "string" },
        activo: { type: "boolean" },
      },
    },
    response: {
      200: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              paciente_id: { type: "string", format: "uuid" },
              sustancia: { type: "string" },
              tipo_reaccion: { type: "string", nullable: true },
              severidad: { type: "string" },
              notas: { type: "string", nullable: true },
              activo: { type: "boolean", nullable: true },
              created_at: { type: "string", nullable: true },
            },
          },
          meta: { type: "object", properties: metaProperties },
        },
      },
    },
  },
} as const;

// ─── Seguros ─────────────────────────────────────────────────────────────────

export const crearSeguroSchema = {
  schema: {
    tags: ["Pacientes / Seguros"],
    summary: "Agregar seguro al paciente",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object",
      required: ["id"],
      properties: { id: { type: "string", format: "uuid" } },
    },
    body: {
      type: "object",
      required: ["aseguradora_id", "numero_poliza"],
      additionalProperties: false,
      properties: {
        aseguradora_id: { type: "string", format: "uuid" },
        numero_poliza: { type: "string", minLength: 1, maxLength: 80 },
        tipo_plan: { type: "string", maxLength: 100 },
        vigencia_inicio: { type: "string", format: "date" },
        vigencia_fin: { type: "string", format: "date" },
      },
    },
    response: {
      201: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              paciente_id: { type: "string", format: "uuid" },
              aseguradora_id: { type: "string", format: "uuid" },
              numero_poliza: { type: "string" },
              tipo_plan: { type: "string", nullable: true },
              vigencia_inicio: { type: "string", nullable: true },
              vigencia_fin: { type: "string", nullable: true },
              activo: { type: "boolean", nullable: true },
              created_at: { type: "string", nullable: true },
              aseguradora: {
                type: "object",
                nullable: true,
                properties: {
                  id: { type: "string", format: "uuid" },
                  nombre: { type: "string" },
                },
              },
            },
          },
          meta: { type: "object", properties: metaProperties },
        },
      },
    },
  },
} as const;

export const listarSegurosSchema = {
  schema: {
    tags: ["Pacientes / Seguros"],
    summary: "Listar seguros del paciente",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object",
      required: ["id"],
      properties: { id: { type: "string", format: "uuid" } },
    },
    querystring: {
      type: "object",
      properties: {
        activo: { type: "boolean" },
        page: { type: "integer", minimum: 1, default: 1 },
        pageSize: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        sortBy: {
          type: "string",
          enum: [...SEGURO_SORT_BY_VALUES],
          default: "created_at",
        },
        sortOrder: { type: "string", enum: ["asc", "desc"], default: "desc" },
      },
    },
    response: {
      200: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    paciente_id: { type: "string", format: "uuid" },
                    aseguradora_id: { type: "string", format: "uuid" },
                    numero_poliza: { type: "string" },
                    tipo_plan: { type: "string", nullable: true },
                    vigencia_inicio: { type: "string", nullable: true },
                    vigencia_fin: { type: "string", nullable: true },
                    activo: { type: "boolean", nullable: true },
                    created_at: { type: "string", nullable: true },
                    aseguradora: {
                      type: "object",
                      nullable: true,
                      properties: {
                        id: { type: "string", format: "uuid" },
                        nombre: { type: "string" },
                        nit: { type: "string", nullable: true },
                      },
                    },
                  },
                },
              },
              pagination: {
                type: "object",
                properties: {
                  page: { type: "integer" },
                  pageSize: { type: "integer" },
                  total: { type: "integer" },
                  totalPages: { type: "integer" },
                },
              },
              sort: {
                type: "object",
                properties: {
                  sortBy: { type: "string" },
                  sortOrder: { type: "string" },
                },
              },
              filters: {
                type: "object",
                properties: {
                  activo: { type: "boolean", nullable: true },
                },
              },
            },
          },
          meta: { type: "object", properties: metaProperties },
        },
      },
    },
  },
} as const;

export const obtenerSeguroSchema = {
  schema: {
    tags: ["Pacientes / Seguros"],
    summary: "Obtener seguro por ID",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object",
      required: ["id", "seguroId"],
      properties: {
        id: { type: "string", format: "uuid" },
        seguroId: { type: "string", format: "uuid" },
      },
    },
    response: {
      200: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              paciente_id: { type: "string", format: "uuid" },
              aseguradora_id: { type: "string", format: "uuid" },
              numero_poliza: { type: "string" },
              tipo_plan: { type: "string", nullable: true },
              vigencia_inicio: { type: "string", nullable: true },
              vigencia_fin: { type: "string", nullable: true },
              activo: { type: "boolean", nullable: true },
              created_at: { type: "string", nullable: true },
              aseguradora: {
                type: "object",
                nullable: true,
                properties: {
                  id: { type: "string", format: "uuid" },
                  nombre: { type: "string" },
                  nit: { type: "string", nullable: true },
                },
              },
            },
          },
          meta: { type: "object", properties: metaProperties },
        },
      },
    },
  },
} as const;

export const actualizarSeguroSchema = {
  schema: {
    tags: ["Pacientes / Seguros"],
    summary: "Actualizar seguro del paciente",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object",
      required: ["id", "seguroId"],
      properties: {
        id: { type: "string", format: "uuid" },
        seguroId: { type: "string", format: "uuid" },
      },
    },
    body: {
      type: "object",
      additionalProperties: false,
      properties: {
        numero_poliza: { type: "string", minLength: 1, maxLength: 80 },
        tipo_plan: { type: "string", maxLength: 100 },
        vigencia_inicio: { type: "string", format: "date" },
        vigencia_fin: { type: "string", format: "date" },
        activo: { type: "boolean" },
      },
    },
    response: {
      200: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              paciente_id: { type: "string", format: "uuid" },
              aseguradora_id: { type: "string", format: "uuid" },
              numero_poliza: { type: "string" },
              tipo_plan: { type: "string", nullable: true },
              vigencia_inicio: { type: "string", nullable: true },
              vigencia_fin: { type: "string", nullable: true },
              activo: { type: "boolean", nullable: true },
              created_at: { type: "string", nullable: true },
              aseguradora: {
                type: "object",
                nullable: true,
                properties: {
                  id: { type: "string", format: "uuid" },
                  nombre: { type: "string" },
                },
              },
            },
          },
          meta: { type: "object", properties: metaProperties },
        },
      },
    },
  },
} as const;

export const eliminarSeguroSchema = {
  schema: {
    tags: ["Pacientes / Seguros"],
    summary: "Eliminar seguro del paciente",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object",
      required: ["id", "seguroId"],
      properties: {
        id: { type: "string", format: "uuid" },
        seguroId: { type: "string", format: "uuid" },
      },
    },
    response: { 204: { type: "null" } },
  },
} as const;
