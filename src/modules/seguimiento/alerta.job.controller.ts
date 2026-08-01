import type { FastifyReply, FastifyRequest } from 'fastify';
import { sendOk } from '../../core/http/response.js';
import { createAlertaJobService } from './alerta.job.service.js';

type EjecutarQuery = { organizacion_id?: string };

export const alertaJobController = {
  async ejecutar(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as EjecutarQuery;
    const job = createAlertaJobService(request.log);
    const result = await job.ejecutar(query.organizacion_id);
    return sendOk(reply, request.requestId, result);
  },
};
