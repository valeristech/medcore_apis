export type LoginInput = {
  email: string;
  password: string;
};

export type RefreshInput = {
  refreshToken: string;
};

export type LogoutInput = {
  refreshToken: string;
};

const envelopeMeta = {
  type: 'object',
  required: ['requestId'],
  properties: {
    requestId: { type: 'string' },
  },
} as const;

const errorEnvelope = {
  type: 'object',
  required: ['success', 'error', 'meta'],
  properties: {
    success: { type: 'boolean', enum: [false] },
    error: {
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        details: {},
      },
    },
    meta: envelopeMeta,
  },
} as const;

const authDataShape = {
  type: 'object',
  required: ['token', 'accessToken', 'refreshToken', 'expiresIn', 'usuario'],
  properties: {
    token: {
      type: 'string',
      description: 'Access JWT (alias de accessToken; se mantiene por compatibilidad).',
    },
    accessToken: { type: 'string' },
    refreshToken: { type: 'string' },
    expiresIn: {
      type: 'string',
      description: 'Ventana del access token (p. ej. 15m).',
    },
    usuario: { type: 'object', additionalProperties: true },
  },
} as const;

export const loginSchema = {
  config: {
    rateLimit: {
      max: 10,
      timeWindow: '15 minutes',
      groupId: 'auth-login',
    },
  },
  schema: {
    tags: ['Autenticación'],
    summary: 'Iniciar sesión',
    description:
      'Valida credenciales y devuelve access JWT + refresh opaco. El access token incluye `permisos` del rol para RBAC.',
    body: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: {
          type: 'string',
          format: 'email',
          description: 'Correo electrónico del usuario',
        },
        password: {
          type: 'string',
          description: 'Contraseña del usuario',
        },
      },
    },
    response: {
      200: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: authDataShape,
          meta: envelopeMeta,
        },
      },
      400: {
        description: 'Validación',
        ...errorEnvelope,
      },
      401: {
        description: 'Credenciales inválidas',
        ...errorEnvelope,
      },
    },
  },
};

export const refreshSchema = {
  config: {
    rateLimit: {
      max: 30,
      timeWindow: '1 minute',
      groupId: 'auth-refresh',
    },
  },
  schema: {
    tags: ['Autenticación'],
    summary: 'Renovar access token',
    description:
      'Intercambia un refresh token válido por un par nuevo (rotación del refresh).',
    body: {
      type: 'object',
      required: ['refreshToken'],
      properties: {
        refreshToken: { type: 'string', minLength: 10 },
      },
    },
    response: {
      200: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: authDataShape,
          meta: envelopeMeta,
        },
      },
      400: { description: 'Validación', ...errorEnvelope },
      401: { description: 'Refresh inválido o expirado', ...errorEnvelope },
    },
  },
};

export const logoutSchema = {
  config: {
    rateLimit: {
      max: 30,
      timeWindow: '1 minute',
      groupId: 'auth-logout',
    },
  },
  schema: {
    tags: ['Autenticación'],
    summary: 'Cerrar sesión (revocar refresh)',
    description: 'Marca como revocado el refresh token enviado.',
    body: {
      type: 'object',
      required: ['refreshToken'],
      properties: {
        refreshToken: { type: 'string', minLength: 10 },
      },
    },
    response: {
      200: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'object',
            required: ['ok'],
            properties: { ok: { type: 'boolean', enum: [true] } },
          },
          meta: envelopeMeta,
        },
      },
      400: { description: 'Validación', ...errorEnvelope },
    },
  },
};

export const meSchema = {
  config: {
    rateLimit: {
      max: 60,
      timeWindow: '1 minute',
      groupId: 'auth-me',
    },
  },
  schema: {
    tags: ['Autenticación'],
    summary: 'Perfil del usuario autenticado',
    description:
      'Requiere Bearer JWT. Permiso RBAC `auth` → acción `me` en los permisos del rol.',
    security: [{ bearerAuth: [] }],
    response: {
      200: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'object',
            required: ['usuario'],
            properties: {
              usuario: { type: 'object', additionalProperties: true },
            },
          },
          meta: envelopeMeta,
        },
      },
      401: { description: 'Sin token o token inválido', ...errorEnvelope },
      403: { description: 'Sin permiso auth:me', ...errorEnvelope },
    },
  },
};
