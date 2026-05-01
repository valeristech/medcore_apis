import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AppEnv } from '../../core/env.js';
import { buildAccessPayload } from '../../core/auth/jwtPayload.js';
import { sendFail, sendOk } from '../../core/http/response.js';
import { authService } from './auth.service.js';
import type { LoginInput, LogoutInput, RefreshInput } from './auth.schemas.js';

type LoginRequest = FastifyRequest<{ Body: LoginInput }>;
type RefreshRequest = FastifyRequest<{ Body: RefreshInput }>;
type LogoutRequest = FastifyRequest<{ Body: LogoutInput }>;

export function createAuthController(env: AppEnv) {
  return {
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

      const payload = buildAccessPayload({
        usuarioId: usuario.id,
        organizacion_id: usuario.organizacion_id,
        rol_id: usuario.rol_id,
        permisos: usuario.rol?.permisos,
      });

      await authService.registrarLoginExitoso({
        usuarioId: usuario.id,
        organizacionId: usuario.organizacion_id,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        requestId,
      });

      const accessToken = await reply.jwtSign(payload);
      const { raw: refreshToken } = await authService.crearRefreshToken(
        usuario.id,
        env.JWT_REFRESH_DAYS,
      );

      return sendOk(reply, requestId, {
        token: accessToken,
        accessToken,
        refreshToken,
        expiresIn: env.JWT_ACCESS_EXPIRES_IN,
        usuario,
      });
    },

    async refresh(request: RefreshRequest, reply: FastifyReply) {
      const { requestId } = request;
      const rotated = await authService.rotarRefreshToken(
        request.body.refreshToken,
        env.JWT_REFRESH_DAYS,
      );

      if (!rotated) {
        return sendFail(
          reply,
          requestId,
          401,
          'UNAUTHORIZED',
          'Refresh token inválido o expirado.',
        );
      }

      const { usuario, rawRefresh } = rotated;
      const payload = buildAccessPayload({
        usuarioId: usuario.id,
        organizacion_id: usuario.organizacion_id,
        rol_id: usuario.rol_id,
        permisos: usuario.rol?.permisos,
      });

      const accessToken = await reply.jwtSign(payload);

      return sendOk(reply, requestId, {
        token: accessToken,
        accessToken,
        refreshToken: rawRefresh,
        expiresIn: env.JWT_ACCESS_EXPIRES_IN,
        usuario,
      });
    },

    async logout(request: LogoutRequest, reply: FastifyReply) {
      const { requestId } = request;
      await authService.revocarRefreshToken(request.body.refreshToken);
      return sendOk(reply, requestId, { ok: true });
    },

    async me(request: FastifyRequest, reply: FastifyReply) {
      const { requestId } = request;
      const usuario = await authService.obtenerUsuarioPorId(request.user.sub);

      if (!usuario) {
        return sendFail(reply, requestId, 401, 'UNAUTHORIZED', 'Usuario no encontrado.');
      }

      return sendOk(reply, requestId, { usuario });
    },
  };
}
