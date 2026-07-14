import { ESTADO_PRESCRIPCION_VALUES } from '../../core/enums/hce.enums.js';

// ─── Input types ──────────────────────────────────────────────────────────────

export type ActualizarPrescripcionInput = {
  medicamento?: string;
  principio_activo?: string;
  dosis?: string;
  via?: string;
  frecuencia?: string;
  duracion?: string;
  cantidad?: number;
  indicaciones?: string;
  estado?: string;
};

export type CrearPrescripcionInput = {
  medicamento: string;
  principio_activo?: string;
  dosis: string;
  via?: string;
  frecuencia: string;
  duracion?: string;
  cantidad?: number;
  indicaciones?: string;
  producto_id?: string;
};

// ─── JSON Schema pieces ───────────────────────────────────────────────────────

const prescripcionShape = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    encuentro_id: { type: 'string', format: 'uuid' },
    producto_id: { type: ['string', 'null'], format: 'uuid' },
    medicamento: { type: 'string' },
    principio_activo: { type: ['string', 'null'] },
    dosis: { type: 'string' },
    via: { type: ['string', 'null'] },
    frecuencia: { type: 'string' },
    duracion: { type: ['string', 'null'] },
    cantidad: { type: ['integer', 'null'] },
    indicaciones: { type: ['string', 'null'] },
    estado: { type: 'string', enum: ESTADO_PRESCRIPCION_VALUES },
    created_at: { type: ['string', 'null'] },
  },
} as const;

const alertaAlergiaShape = {
  type: 'object',
  properties: {
    alergia_id: { type: 'string', format: 'uuid' },
    sustancia: { type: 'string' },
    severidad: { type: 'string' },
    tipo_reaccion: { type: ['string', 'null'] },
  },
} as const;

const stockInfoShape = {
  type: ['object', 'null'],
  properties: {
    cantidad: { type: 'number' },
    bodega: { type: ['string', 'null'] },
  },
} as const;

// UC-HCE-003 — Crear prescripción
export const crearPrescripcionSchema = {
  schema: {
    tags: ['HCE / Prescripciones'],
    summary: 'Crear prescripción (receta)',
    description:
      'Crea una prescripción en estado "activa" para un encuentro abierto. ' +
      'Si se envía `principio_activo`, se cruza contra las alergias del paciente; ' +
      'los matches se retornan en `alertas_alergia` sin bloquear la operación. ' +
      'Si se envía `producto_id`, se informa el stock disponible en la sede.',
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', format: 'uuid', description: 'ID del encuentro' } },
    },
    body: {
      type: 'object',
      required: ['medicamento', 'dosis', 'frecuencia'],
      properties: {
        medicamento: { type: 'string', minLength: 1, maxLength: 300 },
        principio_activo: { type: 'string', maxLength: 200 },
        dosis: { type: 'string', minLength: 1, maxLength: 100 },
        via: { type: 'string', maxLength: 50 },
        frecuencia: { type: 'string', minLength: 1, maxLength: 100 },
        duracion: { type: 'string', maxLength: 100 },
        cantidad: { type: 'integer', minimum: 1 },
        indicaciones: { type: 'string' },
        producto_id: { type: 'string', format: 'uuid' },
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
              prescripcion: prescripcionShape,
              alertas_alergia: { type: 'array', items: alertaAlergiaShape },
              stock: stockInfoShape,
            },
          },
          meta: { type: 'object', properties: { requestId: { type: 'string' } } },
        },
      },
    },
  },
} as const;

// UC-HCE-003 — Listar prescripciones del encuentro
export const listarPrescripcionesSchema = {
  schema: {
    tags: ['HCE / Prescripciones'],
    summary: 'Listar prescripciones del encuentro',
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
            properties: {
              items: { type: 'array', items: prescripcionShape },
            },
          },
          meta: { type: 'object', properties: { requestId: { type: 'string' } } },
        },
      },
    },
  },
} as const;

// Params reutilizables para rutas /prescripciones/:id
const prescripcionIdParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid', description: 'ID de la prescripción' } },
} as const;

const prescripcionOkResponse = {
  type: 'object',
  required: ['success', 'data', 'meta'],
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: { type: 'object', properties: { prescripcion: prescripcionShape } },
    meta: { type: 'object', properties: { requestId: { type: 'string' } } },
  },
} as const;

// UC-HCE-003 — Actualizar prescripción
export const actualizarPrescripcionSchema = {
  schema: {
    tags: ['HCE / Prescripciones'],
    summary: 'Actualizar prescripción',
    description:
      'Actualización parcial de una prescripción. ' +
      'Solo permitido mientras el encuentro esté en estado "abierto". ' +
      'Permite cambiar campos clínicos y el estado (ej: suspendida, cancelada).',
    security: [{ bearerAuth: [] }],
    params: prescripcionIdParams,
    body: {
      type: 'object',
      properties: {
        medicamento: { type: 'string', minLength: 1, maxLength: 300 },
        principio_activo: { type: 'string', maxLength: 200 },
        dosis: { type: 'string', minLength: 1, maxLength: 100 },
        via: { type: 'string', maxLength: 50 },
        frecuencia: { type: 'string', minLength: 1, maxLength: 100 },
        duracion: { type: 'string', maxLength: 100 },
        cantidad: { type: 'integer', minimum: 1 },
        indicaciones: { type: 'string' },
        estado: { type: 'string', enum: ESTADO_PRESCRIPCION_VALUES },
      },
    },
    response: { 200: prescripcionOkResponse },
  },
} as const;

// UC-HCE-003 — Eliminar prescripción (soft delete)
export const eliminarPrescripcionSchema = {
  schema: {
    tags: ['HCE / Prescripciones'],
    summary: 'Eliminar prescripción',
    description:
      'Soft delete de la prescripción. ' +
      'Solo permitido mientras el encuentro esté en estado "abierto".',
    security: [{ bearerAuth: [] }],
    params: prescripcionIdParams,
    response: {
      200: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { type: 'object', properties: { message: { type: 'string' } } },
          meta: { type: 'object', properties: { requestId: { type: 'string' } } },
        },
      },
    },
  },
} as const;
