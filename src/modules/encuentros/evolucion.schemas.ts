import { TIPO_EVOLUCION_VALUES } from '../../core/enums/hce.enums.js';

// ─── Input types ──────────────────────────────────────────────────────────────

export type CrearEvolucionInput = {
  nota: string;
  tipo?: string;
};

// ─── JSON Schema pieces ───────────────────────────────────────────────────────

const evolucionShape = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    encuentro_id: { type: 'string', format: 'uuid' },
    usuario_id: { type: 'string', format: 'uuid' },
    nota: { type: 'string' },
    tipo: { type: 'string', enum: TIPO_EVOLUCION_VALUES },
    fecha: { type: ['string', 'null'] },
    created_at: { type: ['string', 'null'] },
  },
} as const;

// UC-HCE-005 — Agregar evolución
export const crearEvolucionSchema = {
  schema: {
    tags: ['HCE / Evolución'],
    summary: 'Agregar nota de evolución',
    description:
      'Crea una entrada de evolución (médica, enfermería u otro) en un encuentro abierto. ' +
      'El autor (`usuario_id`) se toma siempre del usuario autenticado, nunca del body. ' +
      'Es un registro cronológico de solo-agregar: no existe endpoint para editar ni eliminar ' +
      'entradas ya creadas.',
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', format: 'uuid', description: 'ID del encuentro' } },
    },
    body: {
      type: 'object',
      required: ['nota'],
      properties: {
        nota: { type: 'string', minLength: 1 },
        tipo: { type: 'string', enum: TIPO_EVOLUCION_VALUES },
      },
    },
    response: {
      201: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { type: 'object', properties: { evolucion: evolucionShape } },
          meta: { type: 'object', properties: { requestId: { type: 'string' } } },
        },
      },
    },
  },
} as const;

// UC-HCE-005 — Listar evoluciones del encuentro
export const listarEvolucionesSchema = {
  schema: {
    tags: ['HCE / Evolución'],
    summary: 'Listar notas de evolución del encuentro',
    description: 'Orden cronológico ascendente (la evolución se lee como una narrativa, no como un dashboard).',
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', format: 'uuid', description: 'ID del encuentro' } },
    },
    response: {
      200: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'object',
            properties: { items: { type: 'array', items: evolucionShape } },
          },
          meta: { type: 'object', properties: { requestId: { type: 'string' } } },
        },
      },
    },
  },
} as const;
