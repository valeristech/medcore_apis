import type { FastifyReply, FastifyRequest } from 'fastify';
import { sendOk } from '../../core/http/response.js';
import { createRecordatorioJobService } from './recordatorio.job.service.js';

type EjecutarQuery = { organizacion_id?: string };

export function createRecordatorioController(appEnv: import('../../core/env.js').AppEnv) {
  return {
    async ejecutar(request: FastifyRequest, reply: FastifyReply) {
      const query = request.query as EjecutarQuery;
      const job = createRecordatorioJobService(appEnv, request.log);
      const result = await job.ejecutar(query.organizacion_id);
      return sendOk(reply, request.requestId, result);
    },
  };
}
