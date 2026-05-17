import type { FastifyReply, FastifyRequest } from 'fastify';
import { writeAuditLog } from '../../core/audit/auditLog.js';
import { sendOk } from '../../core/http/response.js';
import { geoCatalogService } from './geo-catalog.service.js';
import type {
  CreateDepartamentoInput,
  CreateMunicipioInput,
  ListDepartamentosQuery,
  ListMunicipiosQuery,
  UpdateDepartamentoInput,
  UpdateMunicipioInput,
} from './geo-catalog.schemas.js';

type IdParams = { id: string };
type DeptoParams = { departamentoId: string };

export const geoCatalogController = {
  async listDepartamentos(request: FastifyRequest, reply: FastifyReply) {
    const result = await geoCatalogService.listDepartamentos(
      request.user.organizacion_id,
      request.query as ListDepartamentosQuery,
    );
    return sendOk(reply, request.requestId, result);
  },

  async createDepartamento(request: FastifyRequest, reply: FastifyReply) {
    const departamento = await geoCatalogService.createDepartamento(
      request.user.organizacion_id,
      request.body as CreateDepartamentoInput,
    );
    await writeAuditLog({
      request,
      organizacionId: request.user.organizacion_id,
      accion: 'create',
      recurso: 'departamento',
      recursoId: departamento.id,
      descripcion: `Catálogo departamento: ${departamento.nombre}`,
      datosDespues: departamento,
    });
    return sendOk(reply, request.requestId, { departamento }, 201);
  },

  async getDepartamento(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParams;
    const departamento = await geoCatalogService.getDepartamento(id, request.user.organizacion_id);
    return sendOk(reply, request.requestId, { departamento });
  },

  async updateDepartamento(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParams;
    const before = await geoCatalogService.getDepartamento(id, request.user.organizacion_id);
    const departamento = await geoCatalogService.updateDepartamento(
      id,
      request.user.organizacion_id,
      request.body as UpdateDepartamentoInput,
    );
    await writeAuditLog({
      request,
      organizacionId: request.user.organizacion_id,
      accion: 'update',
      recurso: 'departamento',
      recursoId: id,
      descripcion: 'Actualización de departamento.',
      datosAntes: before,
      datosDespues: departamento,
    });
    return sendOk(reply, request.requestId, { departamento });
  },

  async removeDepartamento(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParams;
    const before = await geoCatalogService.getDepartamento(id, request.user.organizacion_id);
    await geoCatalogService.removeDepartamento(id, request.user.organizacion_id);
    await writeAuditLog({
      request,
      organizacionId: request.user.organizacion_id,
      accion: 'delete',
      recurso: 'departamento',
      recursoId: id,
      descripcion: 'Soft delete de departamento.',
      datosAntes: before,
      datosDespues: { deleted: true },
    });
    return sendOk(reply, request.requestId, { ok: true });
  },

  async listMunicipios(request: FastifyRequest, reply: FastifyReply) {
    const { departamentoId } = request.params as DeptoParams;
    const result = await geoCatalogService.listMunicipiosByDepartamento(
      departamentoId,
      request.user.organizacion_id,
      request.query as ListMunicipiosQuery,
    );
    return sendOk(reply, request.requestId, result);
  },

  async createMunicipio(request: FastifyRequest, reply: FastifyReply) {
    const municipio = await geoCatalogService.createMunicipio(
      request.user.organizacion_id,
      request.body as CreateMunicipioInput,
    );
    await writeAuditLog({
      request,
      organizacionId: request.user.organizacion_id,
      accion: 'create',
      recurso: 'municipio',
      recursoId: municipio.id,
      descripcion: `Catálogo municipio: ${municipio.nombre}`,
      datosDespues: municipio,
    });
    return sendOk(reply, request.requestId, { municipio }, 201);
  },

  async getMunicipio(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParams;
    const municipio = await geoCatalogService.getMunicipio(id, request.user.organizacion_id);
    return sendOk(reply, request.requestId, { municipio });
  },

  async updateMunicipio(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParams;
    const before = await geoCatalogService.getMunicipio(id, request.user.organizacion_id);
    const municipio = await geoCatalogService.updateMunicipio(
      id,
      request.user.organizacion_id,
      request.body as UpdateMunicipioInput,
    );
    await writeAuditLog({
      request,
      organizacionId: request.user.organizacion_id,
      accion: 'update',
      recurso: 'municipio',
      recursoId: id,
      descripcion: 'Actualización de municipio.',
      datosAntes: before,
      datosDespues: municipio,
    });
    return sendOk(reply, request.requestId, { municipio });
  },

  async removeMunicipio(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as IdParams;
    const before = await geoCatalogService.getMunicipio(id, request.user.organizacion_id);
    await geoCatalogService.removeMunicipio(id, request.user.organizacion_id);
    await writeAuditLog({
      request,
      organizacionId: request.user.organizacion_id,
      accion: 'delete',
      recurso: 'municipio',
      recursoId: id,
      descripcion: 'Soft delete de municipio.',
      datosAntes: before,
      datosDespues: { deleted: true },
    });
    return sendOk(reply, request.requestId, { ok: true });
  },
};
