// ─── Tipos de input ───────────────────────────────────────────────────────────

export type CreateAseguradoraInput = {
  nombre: string;
  nit?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  email?: string | null;
  contacto_nombre?: string | null;
};

export type UpdateAseguradoraInput = {
  nombre?: string;
  nit?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  email?: string | null;
  contacto_nombre?: string | null;
  activa?: boolean;
};

export type SearchAseguradorasQuery = {
  q?: string;
  activa?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: AseguradoraSortBy;
  sortOrder?: "asc" | "desc";
};

export const ASEGURADORA_SORT_BY_VALUES = ["nombre", "created_at"] as const;
export type AseguradoraSortBy = (typeof ASEGURADORA_SORT_BY_VALUES)[number];

// ─── Schemas de rutas ─────────────────────────────────────────────────────────

export const buscarAseguradorasSchema = {
  schema: {
    tags: ["Aseguradoras"],
    summary: "Buscar / listar aseguradoras",
    security: [{ bearerAuth: [] }],
    querystring: {
      type: "object",
      properties: {
        q: { type: "string", description: "Buscar por nombre o NIT" },
        activa: { type: "boolean" },
        page: { type: "integer", minimum: 1, default: 1 },
        pageSize: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        sortBy: {
          type: "string",
          enum: [...ASEGURADORA_SORT_BY_VALUES],
          default: "nombre",
        },
        sortOrder: { type: "string", enum: ["asc", "desc"], default: "asc" },
      },
    },
  },
} as const;

export const crearAseguradoraSchema = {
  schema: {
    tags: ["Aseguradoras"],
    summary: "Crear aseguradora",
    security: [{ bearerAuth: [] }],
    body: {
      type: "object",
      required: ["nombre"],
      properties: {
        nombre: { type: "string", minLength: 1, maxLength: 200 },
        nit: { type: "string", maxLength: 20, nullable: true },
        direccion: { type: "string", nullable: true },
        telefono: { type: "string", maxLength: 30, nullable: true },
        email: {
          type: "string",
          format: "email",
          maxLength: 200,
          nullable: true,
        },
        contacto_nombre: { type: "string", maxLength: 150, nullable: true },
      },
    },
  },
} as const;

export const obtenerAseguradoraSchema = {
  schema: {
    tags: ["Aseguradoras"],
    summary: "Obtener aseguradora por ID",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object",
      required: ["id"],
      properties: { id: { type: "string", format: "uuid" } },
    },
  },
} as const;

export const actualizarAseguradoraSchema = {
  schema: {
    tags: ["Aseguradoras"],
    summary: "Actualizar aseguradora",
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
        nombre: { type: "string", minLength: 1, maxLength: 200 },
        nit: { type: "string", maxLength: 20, nullable: true },
        direccion: { type: "string", nullable: true },
        telefono: { type: "string", maxLength: 30, nullable: true },
        email: {
          type: "string",
          format: "email",
          maxLength: 200,
          nullable: true,
        },
        contacto_nombre: { type: "string", maxLength: 150, nullable: true },
        activa: { type: "boolean" },
      },
    },
  },
} as const;

export const eliminarAseguradoraSchema = {
  schema: {
    tags: ["Aseguradoras"],
    summary: "Eliminar aseguradora (soft delete)",
    security: [{ bearerAuth: [] }],
    params: {
      type: "object",
      required: ["id"],
      properties: { id: { type: "string", format: "uuid" } },
    },
  },
} as const;
