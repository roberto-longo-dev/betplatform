import { type FastifyPluginAsync } from 'fastify'

const healthRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', {
    schema: {
      tags: ['System'],
      summary: 'Health check',
      description: 'Returns server health status and current UTC timestamp. Used by Railway and uptime monitors.',
      response: {
        200: {
          type: 'object',
          required: ['status', 'timestamp'],
          properties: {
            status: { type: 'string', enum: ['ok'] },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    handler: async () => ({
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
    }),
  })
}

export default healthRoute
