import fp from 'fastify-plugin'
import rateLimit from '@fastify/rate-limit'
import { type FastifyPluginAsync } from 'fastify'

const rateLimitPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Retry after ${context.after}.`,
    }),
  })
}

export default fp(rateLimitPlugin, { name: 'rate-limit' })
