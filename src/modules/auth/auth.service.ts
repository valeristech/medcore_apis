import type { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import prisma from '../../config/prisma.js';
import type { LoginInput } from './auth.schemas.js';
import { generateRefreshTokenRaw, hashRefreshToken } from './auth.tokens.js';

export type UsuarioAuthSafe = Omit<
  Prisma.usuarioGetPayload<{ include: { rol: true } }>,
  'password_hash'
>;

export class AuthService {
  async validarCredenciales(data: LoginInput): Promise<UsuarioAuthSafe | null> {
    const { email, password } = data;

    const usuario = await prisma.usuario.findUnique({
      where: { email },
      include: {
        rol: true,
      },
    });

    if (!usuario || usuario.estado !== 'activo' || usuario.deleted === true) {
      return null;
    }

    const esValida = await bcrypt.compare(password, usuario.password_hash);

    if (!esValida) {
      return null;
    }

    const { password_hash: _p, ...datosSeguros } = usuario;
    return datosSeguros;
  }

  async crearRefreshToken(usuarioId: string, diasValidos: number) {
    const raw = generateRefreshTokenRaw();
    const token_hash = hashRefreshToken(raw);
    const expires_at = new Date();
    expires_at.setUTCDate(expires_at.getUTCDate() + diasValidos);

    await prisma.refresh_token.create({
      data: {
        usuario_id: usuarioId,
        token_hash,
        expires_at,
      },
    });

    return { raw, expires_at };
  }

  /**
   * Rota el refresh token: invalida el actual y crea uno nuevo. Devuelve usuario sin password.
   */
  async rotarRefreshToken(
    refreshTokenRaw: string,
    diasValidos: number,
  ): Promise<{ usuario: UsuarioAuthSafe; rawRefresh: string } | null> {
    const token_hash = hashRefreshToken(refreshTokenRaw);
    const row = await prisma.refresh_token.findUnique({
      where: { token_hash },
    });

    const ahora = new Date();
    if (!row || row.revoked_at !== null || row.expires_at < ahora) {
      return null;
    }

    const usuarioActual = await prisma.usuario.findUnique({
      where: { id: row.usuario_id },
      include: { rol: true },
    });

    if (
      !usuarioActual ||
      usuarioActual.estado !== 'activo' ||
      usuarioActual.deleted === true
    ) {
      return null;
    }

    const { rawRefresh } = await prisma.$transaction(async (tx) => {
      await tx.refresh_token.update({
        where: { id: row.id },
        data: { revoked_at: ahora },
      });

      const raw = generateRefreshTokenRaw();
      const nuevoHash = hashRefreshToken(raw);
      const expires_at = new Date();
      expires_at.setUTCDate(expires_at.getUTCDate() + diasValidos);

      await tx.refresh_token.create({
        data: {
          usuario_id: row.usuario_id,
          token_hash: nuevoHash,
          expires_at,
        },
      });

      return { rawRefresh: raw };
    });

    const { password_hash: _p, ...datosSeguros } = usuarioActual;
    return { usuario: datosSeguros, rawRefresh };
  }

  async revocarRefreshToken(refreshTokenRaw: string) {
    const token_hash = hashRefreshToken(refreshTokenRaw);
    await prisma.refresh_token.updateMany({
      where: { token_hash, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }

  async obtenerUsuarioPorId(id: string): Promise<UsuarioAuthSafe | null> {
    const usuario = await prisma.usuario.findUnique({
      where: { id },
      include: { rol: true },
    });

    if (!usuario || usuario.estado !== 'activo' || usuario.deleted === true) {
      return null;
    }

    const { password_hash: _p, ...datosSeguros } = usuario;
    return datosSeguros;
  }
}

export const authService = new AuthService();
