import {
  TIPO_ENCUENTRO_VALUES,
  TIPO_DIAGNOSTICO_VALUES,
} from '../../core/enums/hce.enums.js';

// ─── Input types ─────────────────────────────────────────────────────────────

export type IniciarEncuentroInput = {
  paciente_id: string;
  cita_id?: string;
  sede_id: string;
  tipo: string;
  motivo_consulta?: string;
  plantilla_id?: string;
};

export type DiagnosticoInput = {
  codigo_icd10: string;
  descripcion: string;
  tipo: string;
  notas?: string;
};

export type CrearNotaInput = {
  motivo_consulta?: string;
  enfermedad_actual?: string;
  antecedentes?: string;
  examen_fisico?: string;
  impresion_diagnostica?: string;
  plan_tratamiento?: string;
  estudios_solicitados_texto?: string;
  recomendaciones?: string;
  datos_adicionales?: Record<string, unknown>;
  diagnosticos?: DiagnosticoInput[];
};

export type ActualizarNotaInput = Partial<CrearNotaInput>;

// ─── JSON Schemas ─────────────────────────────────────────────────────────────

const encuentroShape = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    paciente_id: { type: 'string', format: 'uuid' },
    usuario_id: { type: 'string', format: 'uuid' },
    sede_id: { type: 'string', format: 'uuid' },
    cita_id: { type: ['string', 'null'], format: 'uuid' },
    plantilla_id: { type: ['string', 'null'], format: 'uuid' },
    tipo: { type: 'string', enum: TIPO_ENCUENTRO_VALUES },
    motivo_consulta: { type: ['string', 'null'] },
    estado: { type: 'string' },
    fecha: { type: 'string' },
    created_at: { type: ['string', 'null'] },
    updated_at: { type: ['string', 'null'] },
  },
} as const;

// ─── Nota clínica shared pieces ───────────────────────────────────────────────

const diagnosticoInputShape = {
  type: 'object',
  required: ['codigo_icd10', 'descripcion', 'tipo'],
  properties: {
    codigo_icd10: { type: 'string', minLength: 1, maxLength: 20 },
    descripcion: { type: 'string', minLength: 1, maxLength: 500 },
    tipo: { type: 'string', enum: TIPO_DIAGNOSTICO_VALUES },
    notas: { type: 'string' },
  },
} as const;

const notaShape = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    encuentro_id: { type: 'string', format: 'uuid' },
    motivo_consulta: { type: ['string', 'null'] },
    enfermedad_actual: { type: ['string', 'null'] },
    antecedentes: { type: ['string', 'null'] },
    examen_fisico: { type: ['string', 'null'] },
    impresion_diagnostica: { type: ['string', 'null'] },
    plan_tratamiento: { type: ['string', 'null'] },
    estudios_solicitados_texto: { type: ['string', 'null'] },
    recomendaciones: { type: ['string', 'null'] },
    datos_adicionales: { type: ['object', 'null'] },
    created_at: { type: ['string', 'null'] },
    updated_at: { type: ['string', 'null'] },
    diagnosticos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          codigo_icd10: { type: 'string' },
          descripcion: { type: 'string' },
          tipo: { type: 'string' },
          notas: { type: ['string', 'null'] },
          created_at: { type: ['string', 'null'] },
        },
      },
    },
  },
} as const;

const notaBodyProperties = {
  motivo_consulta: { type: 'string' },
  enfermedad_actual: { type: 'string' },
  antecedentes: { type: 'string' },
  examen_fisico: { type: 'string' },
  impresion_diagnostica: { type: 'string' },
  plan_tratamiento: { type: 'string' },
  estudios_solicitados_texto: { type: 'string' },
  recomendaciones: { type: 'string' },
  datos_adicionales: { type: 'object' },
  diagnosticos: { type: 'array', items: diagnosticoInputShape },
} as const;

const notaResponseOk = {
  type: 'object',
  required: ['success', 'data', 'meta'],
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: { type: 'object', properties: { nota: notaShape } },
    meta: { type: 'object', properties: { requestId: { type: 'string' } } },
  },
} as const;

// UC-HCE-002 — Crear nota clínica
export const crearNotaSchema = {
  schema: {
    tags: ['HCE / Nota Clínica'],
    summary: 'Crear nota clínica del encuentro',
    description:
      'Crea la nota clínica (SOAP) de un encuentro abierto. ' +
      'Solo se permite una nota por encuentro. ' +
      'Incluye diagnósticos ICD-10 opcionales que se crean junto a la nota.',
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', format: 'uuid', description: 'ID del encuentro' } },
    },
    body: {
      type: 'object',
      properties: notaBodyProperties,
    },
    response: { 201: notaResponseOk },
  },
} as const;

// UC-HCE-002 — Actualizar nota clínica (auto-guardado)
export const actualizarNotaSchema = {
  schema: {
    tags: ['HCE / Nota Clínica'],
    summary: 'Actualizar nota clínica (auto-guardado)',
    description:
      'Actualización parcial de la nota clínica. Diseñado para auto-guardado cada 30s. ' +
      'Si se envía el campo "diagnosticos", reemplaza todos los diagnósticos actuales. ' +
      'Solo editable mientras el encuentro esté en estado "abierto".',
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', format: 'uuid', description: 'ID del encuentro' } },
    },
    body: {
      type: 'object',
      properties: notaBodyProperties,
    },
    response: { 200: notaResponseOk },
  },
} as const;

export const iniciarEncuentroSchema = {
  schema: {
    tags: ['HCE / Encuentros'],
    summary: 'Iniciar consulta (abrir encuentro)',
    description:
      'Crea un nuevo encuentro clínico en estado "abierto". ' +
      'Si se indica cita_id, la cita pasa a estado "en_curso". ' +
      'La respuesta incluye el contexto clínico del paciente (alergias, medicación activa, últimos encuentros, estudios pendientes).',
    security: [{ bearerAuth: [] }],
    body: {
      type: 'object',
      required: ['paciente_id', 'sede_id', 'tipo'],
      properties: {
        paciente_id: { type: 'string', format: 'uuid' },
        cita_id: { type: 'string', format: 'uuid' },
        sede_id: { type: 'string', format: 'uuid' },
        tipo: { type: 'string', enum: TIPO_ENCUENTRO_VALUES },
        motivo_consulta: { type: 'string', minLength: 1 },
        plantilla_id: { type: 'string', format: 'uuid' },
      },
    },
    response: {
      201: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'object',
            properties: {
              encuentro: encuentroShape,
              contexto: {
                type: 'object',
                properties: {
                  alergias: { type: 'array', items: { type: 'object' } },
                  medicacion_activa: { type: 'array', items: { type: 'object' } },
                  ultimos_encuentros: { type: 'array', items: { type: 'object' } },
                  estudios_pendientes: { type: 'array', items: { type: 'object' } },
                },
              },
            },
          },
          meta: {
            type: 'object',
            properties: { requestId: { type: 'string' } },
          },
        },
      },
    },
  },
} as const;
