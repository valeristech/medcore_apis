import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../../core/auth/requireAuth.js";
import { requirePermission } from "../../core/auth/requirePermission.js";
import { convenioAseguradoraController } from "./convenio-aseguradora.controller.js";
import {
  actualizarConvenioSchema,
  buscarConveniosSchema,
  crearConvenioSchema,
  eliminarConvenioSchema,
  obtenerConvenioSchema,
} from "./convenio-aseguradora.schemas.js";

export const convenioAseguradoraRoutes: FastifyPluginAsync = async (app) => {
  const pLeer = requirePermission("aseguradoras", "leer");
  const pCrear = requirePermission("aseguradoras", "crear");
  const pEditar = requirePermission("aseguradoras", "editar");
  const pEliminar = requirePermission("aseguradoras", "eliminar");

  /** GET /convenios-aseguradora — Listar convenios del tenant */
  app.get(
    "/convenios-aseguradora",
    {
      ...buscarConveniosSchema,
      preHandler: [requireAuth, pLeer],
    },

    convenioAseguradoraController.list,
  );

  /** POST /convenios-aseguradora — Vincular aseguradora al tenant */
  app.post(
    "/convenios-aseguradora",
    {
      ...crearConvenioSchema,
      preHandler: [requireAuth, pCrear],
    },
    convenioAseguradoraController.create,
  );

  /** GET /convenios-aseguradora/:id — Obtener convenio por ID */
  app.get(
    "/convenios-aseguradora/:id",
    {
      ...obtenerConvenioSchema,
      preHandler: [requireAuth, pLeer],
    },
    convenioAseguradoraController.getById,
  );

  /** PATCH /convenios-aseguradora/:id — Actualizar convenio */
  app.patch(
    "/convenios-aseguradora/:id",
    {
      ...actualizarConvenioSchema,
      preHandler: [requireAuth, pEditar],
    },
    convenioAseguradoraController.update,
  );

  /** DELETE /convenios-aseguradora/:id — Eliminar convenio (soft delete) */
  app.delete(
    "/convenios-aseguradora/:id",
    {
      ...eliminarConvenioSchema,
      preHandler: [requireAuth, pEliminar],
    },
    convenioAseguradoraController.remove,
  );
};
