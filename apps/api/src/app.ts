import Fastify, { type FastifyError } from 'fastify'
import { config } from './config'
import prismaPlugin from './plugins/prisma'
import redisPlugin from './plugins/redis'
import swaggerPlugin from './plugins/swagger'
import rateLimitPlugin from './plugins/rate-limit'
import jwtPlugin from './plugins/jwt'
import healthRoute from './routes/health'
import authRoute from './routes/auth'

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.server.logLevel,
    },
  })

  // Plugins — order matters:
  // swagger must come before routes so route schemas are picked up.
  // rate-limit and jwt must be registered with fastify-plugin (scoped to root) before routes.
  await app.register(swaggerPlugin)
  await app.register(rateLimitPlugin)
  await app.register(jwtPlugin)
  await app.register(prismaPlugin)
  await app.register(redisPlugin)

  // Consistent error shape across all failure modes
  app.setErrorHandler<FastifyError>(async (error, _request, reply) => {
    const statusCode = error.statusCode ?? 500

    if (statusCode >= 500) {
      app.log.error(error)
    }

    await reply.status(statusCode).send({
      statusCode,
      error: httpStatusText(statusCode),
      // Don't leak internals on 5xx
      message: statusCode < 500 ? error.message : 'Internal Server Error',
    })
  })

  // Routes
  await app.register(healthRoute)
  await app.register(authRoute, { prefix: '/auth' })

  return app
}

function httpStatusText(code: number): string {
  const map: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
  }
  return map[code] ?? 'Error'
}
