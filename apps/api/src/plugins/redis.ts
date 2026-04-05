import Redis from 'ioredis'
import fp from 'fastify-plugin'
import { type FastifyPluginAsync } from 'fastify'
import { config } from '../config'

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis
  }
}

const redisPlugin: FastifyPluginAsync = async (fastify) => {
  const redis = new Redis(config.redis.url, {
    // Fail fast on startup rather than silently queuing commands
    enableOfflineQueue: false,
    lazyConnect: true,
  })

  await redis.connect()
  fastify.log.info('Redis connected')

  fastify.decorate('redis', redis)

  fastify.addHook('onClose', async () => {
    await redis.quit()
    fastify.log.info('Redis disconnected')
  })
}

export default fp(redisPlugin, { name: 'redis' })
