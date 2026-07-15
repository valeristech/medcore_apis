import { TIPO_ESTUDIO_VALUES, ESTADO_ESTUDIO_VALUES } from '../../core/enums/hce.enums.js';

// ─── Input types ──────────────────────────────────────────────────────────────

export type CrearEstudioInput = {
  tipo: string;
  nombre: string;
  descripcion?: string;
  urgente?: boolean;
};

export type ActualizarEstudioInput = {
  tipo?: string;
  nombre?: string;
  descripcion?: string;
  urgente?: boolean;
  resultado_texto?: string;
  estado?: string;
};

// ─── JSON Schema pieces ───────────────────────────────────────────────────────

const estudioShape = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    encuentro_id: { type: 'string', format: 'uuid' },
    tipo: { type: 'string', enum: TIPO_ESTUDIO_VALUES },
    nombre: { type: 'string' },
    descripcion: { type: ['string', 'null'] },
    urgente: { type: 'boolean' },
    estado: { type: 'string', enum: ESTADO_ESTUDIO_VALUES },
    resultado_texto: { type: ['string', 'null'] },
    fecha_resultado: { type: ['string', 'null'] },
    created_at: { type: ['string', 'null'] },
    updated_at: { type: ['string', 'null'] },
  },
} as const;

// UC-HCE-004 — Solicitar estudio
export const crearEstudioSchema = {
  schema: {
    tags: ['HCE / Estudios'],
    summary: 'Solicitar estudio (laboratorio, imagen, patología, otro)',
    description:
      'Crea una orden de estudio en estado "solicitado" para un encuentro abierto. ' +
      'El resultado se carga después mediante PATCH /estudios/:id, incluso si para ' +
      'entonces el encuentro ya está cerrado o firmado.',
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', format: 'uuid', description: 'ID del encuentro' } },
    },
    body: {
      type: 'object',
      required: ['tipo', 'nombre'],
      properties: {
        tipo: { type: 'string', enum: TIPO_ESTUDIO_VALUES },
        nombre: { type: 'string', minLength: 1, maxLength: 300 },
        descripcion: { type: 'string' },
        urgente: { type: 'boolean' },
      },
    },
    response: {
      201: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { type: 'object', properties: { estudio: estudioShape } },
          meta: { type: 'object', properties: { requestId: { type: 'string' } } },
        },
      },
    },
  },
} as const;

// UC-HCE-004 — Listar estudios del encuentro
export const listarEstudiosSchema = {
  schema: {
    tags: ['HCE / Estudios'],
    summary: 'Listar estudios solicitados del encuentro',
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
            properties: { items: { type: 'array', items: estudioShape } },
          },
          meta: { type: 'object', properties: { requestId: { type: 'string' } } },
        },
      },
    },
  },
} as const;

// Params reutilizables para rutas /estudios/:id
const estudioIdParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid', description: 'ID del estudio' } },
} as const;

// UC-HCE-004 — Actualizar estudio (registrar resultado / cambiar estado)
export const actualizarEstudioSchema = {
  schema: {
    tags: ['HCE / Estudios'],
    summary: 'Actualizar estudio (registrar resultado o cambiar estado)',
    description:
      'Actualización parcial. Permite corregir tipo/nombre/descripcion/urgente, cargar ' +
      '`resultado_texto` (fija `fecha_resultado` automáticamente) y mover `estado` entre ' +
      'solicitado → resultado_cargado → informado. ' +
      'A diferencia de la nota clínica y las prescripciones, NO requiere que el encuentro ' +
      'esté abierto: los resultados suelen llegar después de que el encuentro ya fue cerrado o firmado.',
    security: [{ bearerAuth: [] }],
    params: estudioIdParams,
    body: {
      type: 'object',
      properties: {
        tipo: { type: 'string', enum: TIPO_ESTUDIO_VALUES },
        nombre: { type: 'string', minLength: 1, maxLength: 300 },
        descripcion: { type: 'string' },
        urgente: { type: 'boolean' },
        resultado_texto: { type: 'string' },
        estado: { type: 'string', enum: ESTADO_ESTUDIO_VALUES },
      },
    },
    response: {
      200: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { type: 'object', properties: { estudio: estudioShape } },
          meta: { type: 'object', properties: { requestId: { type: 'string' } } },
        },
      },
    },
  },
} as const;
