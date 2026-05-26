import type { FastifyReply, FastifyRequest } from "fastify";
import { sendOk } from "../../core/http/response.js";
import { writeAuditLog } from "../../core/audit/auditLog.js";
import { aseguradoraService } from "./aseguradora.service.js";
import type {
  CreateAseguradoraInput,
  SearchAseguradorasQuery,
  UpdateAseguradoraInput,
} from "./aseguradora.schemas.js";

type IdParam = { id: string };

export const aseguradoraController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const result = await aseguradoraService.list(
      request.query as SearchAseguradorasQuery,
    );
    return sendOk(reply, request.requestId, result);
  },

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParam;
    const aseguradora = await aseguradoraService.getById(id);
    return sendOk(reply, request.requestId, aseguradora);
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const tenantOrgId = request.user.organizacion_id;
    const aseguradora = await aseguradoraService.create(
      request.body as CreateAseguradoraInput,
    );

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: "crear",
      recurso: "aseguradoras",
      recursoId: aseguradora.id,
      descripcion: `Aseguradora creada: ${aseguradora.nombre}`,
      datosAntes: undefined,
      datosDespues: aseguradora,
    });

    return sendOk(reply, request.requestId, aseguradora, 201);
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParam;
    const tenantOrgId = request.user.organizacion_id;
    const aseguradora = await aseguradoraService.update(
      id,
      request.body as UpdateAseguradoraInput,
    );

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: "actualizar",
      recurso: "aseguradoras",
      recursoId: id,
      descripcion: `Aseguradora actualizada: ${aseguradora.nombre}`,
      datosAntes: undefined,
      datosDespues: request.body,
    });

    return sendOk(reply, request.requestId, aseguradora);
  },

  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParam;
    const tenantOrgId = request.user.organizacion_id;

    await aseguradoraService.remove(id);

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: "eliminar",
      recurso: "aseguradoras",
      recursoId: id,
      descripcion: "Aseguradora eliminada (soft delete).",
      datosAntes: undefined,
      datosDespues: undefined,
    });

    return sendOk(reply, request.requestId, null, 204);
  },
};
