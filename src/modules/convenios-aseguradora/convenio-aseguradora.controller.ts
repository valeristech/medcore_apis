import type { FastifyReply, FastifyRequest } from "fastify";
import { sendOk } from "../../core/http/response.js";
import { writeAuditLog } from "../../core/audit/auditLog.js";
import { convenioAseguradoraService } from "./convenio-aseguradora.service.js";
import type {
  CreateConvenioInput,
  SearchConveniosQuery,
  UpdateConvenioInput,
} from "./convenio-aseguradora.schemas.js";

type IdParam = { id: string };

export const convenioAseguradoraController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const tenantOrgId = request.user.organizacion_id;
    const result = await convenioAseguradoraService.list(
      tenantOrgId,
      request.query as SearchConveniosQuery,
    );
    return sendOk(reply, request.requestId, result);
  },

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParam;
    const tenantOrgId = request.user.organizacion_id;

    const convenio = await convenioAseguradoraService.getById(id, tenantOrgId);
    return sendOk(reply, request.requestId, convenio);
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const tenantOrgId = request.user.organizacion_id;
    const input = request.body as CreateConvenioInput;
    const convenio = await convenioAseguradoraService.create(
      tenantOrgId,
      input,
    );

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: "crear",
      recurso: "convenios_aseguradora",
      recursoId: convenio.id,
      descripcion: `Convenio creado con aseguradora: ${convenio.aseguradora.nombre}`,
      datosAntes: undefined,
      datosDespues: convenio,
    });

    return sendOk(reply, request.requestId, convenio, 201);
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParam;
    const tenantOrgId = request.user.organizacion_id;
    const convenio = await convenioAseguradoraService.update(
      id,
      tenantOrgId,
      request.body as UpdateConvenioInput,
    );

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: "actualizar",
      recurso: "convenios_aseguradora",
      recursoId: id,
      descripcion: `Convenio actualizado: aseguradora ${convenio.aseguradora.nombre}`,
      datosAntes: undefined,
      datosDespues: request.body,
    });

    return sendOk(reply, request.requestId, convenio);
  },

  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParam;
    const tenantOrgId = request.user.organizacion_id;

    await convenioAseguradoraService.remove(id, tenantOrgId);

    await writeAuditLog({
      request,
      organizacionId: tenantOrgId,
      accion: "eliminar",
      recurso: "convenios_aseguradora",
      recursoId: id,
      descripcion: "Convenio de aseguradora eliminado (soft delete).",
      datosAntes: undefined,
      datosDespues: undefined,
    });

    return sendOk(reply, request.requestId, null, 204);
  },
};
