import { TIPO_FIRMA_VALUES } from '../../core/enums/hce.enums.js';

// ─── JSON Schema pieces ───────────────────────────────────────────────────────

const firmaShape = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    encuentro_id: { type: 'string', format: 'uuid' },
    usuario_id: { type: 'string', format: 'uuid' },
    tipo: { type: 'string', enum: TIPO_FIRMA_VALUES },
    hash_documento: { type: ['string', 'null'] },
    fecha_firma: { type: ['string', 'null'] },
    ip_origen: { type: ['string', 'null'] },
  },
} as const;

const encuentroFirmadoShape = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    cita_id: { type: ['string', 'null'], format: 'uuid' },
    estado: { type: 'string' },
    fecha: { type: ['string', 'null'] },
    updated_at: { type: ['string', 'null'] },
  },
} as const;

// UC-HCE-006 — Firmar y cerrar encuentro
export const firmarEncuentroSchema = {
  schema: {
    tags: ['HCE / Firma'],
    summary: 'Firmar y cerrar encuentro',
    description:
      'Genera un hash SHA-256 de la nota clínica + diagnósticos + prescripciones vigentes, ' +
      'registra la firma electrónica y cierra el encuentro (estado "firmado"). ' +
      'Si el encuentro tiene cita asociada, la cita pasa a "completada". ' +
      'Solo puede firmar el médico dueño del encuentro (usuario_id del encuentro debe ' +
      'coincidir con el usuario autenticado); requiere que exista una nota clínica. ' +
      'A partir de la firma, la nota, los diagnósticos y las prescripciones dejan de ser ' +
      'editables (bloqueado por el guard de "encuentro abierto" en cada uno de esos endpoints). ' +
      'Los estudios solicitados siguen pudiendo actualizarse después (los resultados de ' +
      'laboratorio suelen llegar más tarde).',
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
              firma: firmaShape,
              encuentro: encuentroFirmadoShape,
            },
          },
          meta: { type: 'object', properties: { requestId: { type: 'string' } } },
        },
      },
    },
  },
} as const;
