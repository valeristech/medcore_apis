import bcrypt from 'bcryptjs';
import prisma from '../../config/prisma.js';
import type { LoginInput } from './auth.schemas.js';

export class AuthService {
  async validarCredenciales(data: LoginInput) {
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

    const { password_hash, ...datosSeguros } = usuario;
    return datosSeguros;
  }
}

export const authService = new AuthService();