/** Esquema OpenAPI/Fastify para GET /api/health */
export const healthRouteSchema = {
  schema: {
    tags: ['Sistema'],
    summary: 'Health check',
    description:
      'Indica que el servicio está activo. Incluye `meta.requestId` y el header `x-request-id`.',
    response: {
      200: {
        description: 'Servicio operativo',
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'object',
            required: ['status', 'message', 'timestamp'],
            properties: {
              status: { type: 'string', example: 'ok' },
              message: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
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
    },
  },
} as const;
