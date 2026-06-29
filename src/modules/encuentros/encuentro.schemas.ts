import {
  TIPO_ENCUENTRO_VALUES,
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
