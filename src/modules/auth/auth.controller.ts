import type { FastifyReply, FastifyRequest } from 'fastify';
import { sendFail, sendOk } from '../../core/http/response.js';
import { authService } from './auth.service.js';
import type { LoginInput } from './auth.schemas.js';

type LoginRequest = FastifyRequest<{ Body: LoginInput }>;

export class AuthController {
  async login(request: LoginRequest, reply: FastifyReply) {
    const { requestId } = request;
    const usuario = await authService.validarCredenciales(request.body);

    if (!usuario) {
      return sendFail(
        reply,
        requestId,
        401,
        'UNAUTHORIZED',
        'Credenciales inválidas',
      );
    }

    const token = await reply.jwtSign({
      sub: usuario.id,
      organizacion_id: usuario.organizacion_id,
      rol_id: usuario.rol_id,
    });

    return sendOk(reply, requestId, { token, usuario });
  }
}

export const authController = new AuthController();
