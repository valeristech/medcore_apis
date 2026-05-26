import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../../core/auth/requireAuth.js";
import { requirePermission } from "../../core/auth/requirePermission.js";
import { aseguradoraController } from "./aseguradora.controller.js";
import {
  actualizarAseguradoraSchema,
  buscarAseguradorasSchema,
  crearAseguradoraSchema,
  eliminarAseguradoraSchema,
  obtenerAseguradoraSchema,
} from "./aseguradora.schemas.js";

export const aseguradoraRoutes: FastifyPluginAsync = async (app) => {
  const pLeer = requirePermission("aseguradoras", "leer");
  const pCrear = requirePermission("aseguradoras", "crear");
  const pEditar = requirePermission("aseguradoras", "editar");
  const pEliminar = requirePermission("aseguradoras", "eliminar");

  /** GET /aseguradoras — Buscar / listar aseguradoras */
  app.get(
    "/aseguradoras",
    {
      ...buscarAseguradorasSchema,
      preHandler: [requireAuth, pLeer],
    },
    aseguradoraController.list,
  );

  /** POST /aseguradoras — Crear aseguradora */
  app.post(
    "/aseguradoras",
    {
      ...crearAseguradoraSchema,
      preHandler: [requireAuth, pCrear],
    },
    aseguradoraController.create,
  );

  /** GET /aseguradoras/:id — Obtener aseguradora por ID */
  app.get(
    "/aseguradoras/:id",
    {
      ...obtenerAseguradoraSchema,
      preHandler: [requireAuth, pLeer],
    },
    aseguradoraController.getById,
  );

  /** PATCH /aseguradoras/:id — Actualizar aseguradora */
  app.patch(
    "/aseguradoras/:id",
    {
      ...actualizarAseguradoraSchema,
      preHandler: [requireAuth, pEditar],
    },
    aseguradoraController.update,
  );

  /** DELETE /aseguradoras/:id — Eliminar aseguradora (soft delete) */
  app.delete(
    "/aseguradoras/:id",
    {
      ...eliminarAseguradoraSchema,
      preHandler: [requireAuth, pEliminar],
    },
    aseguradoraController.remove,
  );
};
