export type LoginInput = {
    email: string;
    password: string;
  };
  
export const loginSchema = {
    schema: {
      tags: ['Autenticación'],
      summary: 'Iniciar sesión',
      description: 'Valida las credenciales del usuario y devuelve un token JWT.',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { 
            type: 'string', 
            format: 'email',
            description: 'Correo electrónico del usuario'
          },
          password: { 
            type: 'string',             
            description: 'Contraseña del usuario'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          required: ['success', 'data', 'meta'],
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: {
              type: 'object',
              required: ['token', 'usuario'],
              properties: {
                token: { type: 'string' },
                usuario: { type: 'object', additionalProperties: true },
              },
            },
            meta: {
              type: 'object',
              required: ['requestId'],
              properties: {
                requestId: { type: 'string' },
              },
            },
          },
        },
        400: {
          type: 'object',
          required: ['success', 'error', 'meta'],
          properties: {
            success: { type: 'boolean', enum: [false] },
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string' },
                details: {},
              },
            },
            meta: {
              type: 'object',
              required: ['requestId'],
              properties: {
                requestId: { type: 'string' },
              },
            },
          },
        },
        401: {
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
            meta: {
              type: 'object',
              required: ['requestId'],
              properties: {
                requestId: { type: 'string' },
              },
            },
          },
        },
      }
    }
  };