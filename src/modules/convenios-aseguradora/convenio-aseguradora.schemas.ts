// ─── Tipo auxiliar para servicios_precios ────────────────────────────────────

export type ServicioPrecio = {
  servicio_id?: string;
  nombre_servicio: string;
  precio_negociado: number;
};

// ─── Tipos de input ───────────────────────────────────────────────────────────

export type CreateConvenioInput = {
  aseguradora_id: string;
  vigencia_inicio: string; // ISO date: "2026-01-01"
  vigencia_fin?: string | null;
  servicios_precios?: ServicioPrecio[];
};

export type UpdateConvenioInput = {
  vigencia_inicio?: string;
  vigencia_fin?: string | null;
  servicios_precios?: ServicioPrecio[];
  activo?: boolean;
};

export type SearchConveniosQuery = {
  activo?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: ConvenioSortBy;
  sortOrder?: "asc" | "desc";
};

export const CONVENIO_SORT_BY_VALUES = [
  "vigencia_inicio",
  "created_at",
] as const;
export type ConvenioSortBy = (typeof CONVENIO_SORT_BY_VALUES)[number];

// ─── Schemas de rutas ─────────────────────────────────────────────────────────

const servicioPrecioShape = {
  type: "object",
  required: ["nombre_servicio", "precio_negociado"],
  properties: {
    servicio_id: { type: "string", format: "uuid" },
    nombre_servicio: { type: "string", minLength: 1 },
    precio_negociado: { type: "number", minimum: 0 },
  },
} as const;

export const buscarConveniosSchema = {
  schema: {
    tags: ["Aseguradoras / Convenios"],
    summary: "Listar convenios de aseguradoras del tenant",
    security: [{ bearerAuth: [] }],
    querystring: {
      type: "object",
      properties: {
        activo: { type: "boolean" },
        page: { type: "integer", minimum: 1, default: 1 },
        pageSize: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        sortBy: {
          type: "string",
          enum: [...CONVENIO_SORT_BY_VALUES],
          default: "created_at",
        },
        sortOrder: { type: "string", enum: ["asc", "desc"], default: "asc" },
      },
    },
  },
} as const;

export const crearConvenioSchema = {
  schema: {
    tags: ["Aseguradoras / Convenios"],
    summary: "Vincular aseguradora al tenant (crear convenio)",
    security: [{ bearerAuth: [] }],
    body: {
      type: "object",
      required: ["aseguradora_id", "vigencia_inicio"],
      properties: {
        aseguradora_id: { type: "string", format: "uuid" },
        vigencia_inicio: { type: "string", format: "date" },
        vigencia_fin: { type: "string", format: "date", nullable: true },
        servicios_precios: {
          type: "array",
          items: servicioPrecioShape,
          default: [],
        },
      },
    },
  },
} as const;

export const obtenerConvenioSchema = {
  schema: {
    tags: ["Aseguradoras / Convenios"],
    summary: "Obtener convenio por ID",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object",
      required: ["id"],
      properties: { id: { type: "string", format: "uuid" } },
    },
  },
} as const;

export const actualizarConvenioSchema = {
  schema: {
    tags: ["Aseguradoras / Convenios"],
    summary: "Actualizar convenio de aseguradora",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object",
      required: ["id"],
      properties: { id: { type: "string", format: "uuid" } },
    },
    body: {
      type: "object",
      minProperties: 1,
      properties: {
        vigencia_inicio: { type: "string", format: "date" },
        vigencia_fin: { type: "string", format: "date", nullable: true },
        servicios_precios: {
          type: "array",
          items: servicioPrecioShape,
        },
        activo: { type: "boolean" },
      },
    },
  },
} as const;

export const eliminarConvenioSchema = {
  schema: {
    tags: ["Aseguradoras / Convenios"],
    summary: "Eliminar convenio de aseguradora (soft delete)",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object",
      required: ["id"],
      properties: { id: { type: "string", format: "uuid" } },
    },
  },
} as const;
