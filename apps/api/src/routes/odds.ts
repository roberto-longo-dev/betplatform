import '@fastify/websocket'
import { type FastifyPluginAsync } from 'fastify'
import { type PrismaClient } from '@prisma/client'
import { type Redis } from 'ioredis'
import { OddsService } from '../services/odds.service'
import { config } from '../config'

const ODDS_INTERVAL_MS = 3_000
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1_000
const EXCLUDED_CACHE_TTL_S = 300 // 5 minutes

/**
 * Check whether a user is self-excluded.
 * Redis is the fast path (cached for 5 min). PostgreSQL is the authoritative fallback.
 */
async function isSelfExcluded(
  userId: string,
  redis: Redis,
  prisma: PrismaClient,
): Promise<boolean> {
  const cached = await redis.get(`excluded:${userId}`)
  if (cached !== null) return cached === '1'

  const record = await prisma.userSession.findFirst({
    where: { userId, selfExcluded: true },
    select: { id: true },
  })

  const excluded = record !== null
  // Cache result to avoid a DB hit on every heartbeat
  await redis.set(`excluded:${userId}`, excluded ? '1' : '0', 'EX', EXCLUDED_CACHE_TTL_S)
  return excluded
}

const oddsRoute: FastifyPluginAsync = async (fastify) => {
  const oddsService = new OddsService(config.oddsApiKey)

  fastify.get('/live', { websocket: true }, async (socket, request) => {
    // ── Authentication ──────────────────────────────────────────────────────
    // JWT is verified against the Authorization header sent during the HTTP
    // upgrade handshake — standard Bearer token, same as REST endpoints.
    let userId: string
    try {
      const payload = await request.jwtVerify<{ sub: string }>()
      userId = payload.sub
    } catch {
      socket.close(1008, 'Unauthorized')
      return
    }

    // ── Self-exclusion gate ─────────────────────────────────────────────────
    try {
      if (await isSelfExcluded(userId, fastify.redis, fastify.prisma)) {
        socket.close(1008, 'Self-excluded')
        return
      }
    } catch (err) {
      fastify.log.error(err, 'Self-exclusion check failed on connect')
      socket.close(1011, 'Internal error')
      return
    }

    fastify.log.info({ userId }, 'WebSocket odds connection opened')

    // ── Odds broadcast ──────────────────────────────────────────────────────
    const send = async () => {
      if (socket.readyState !== 1 /* WebSocket.OPEN */) return
      try {
        const data = await oddsService.getLiveOdds()
        socket.send(JSON.stringify({ type: 'odds', data, timestamp: new Date().toISOString() }))
      } catch (err) {
        fastify.log.error(err, 'Failed to fetch/send odds')
      }
    }

    // Send immediately on connect, then every 3 seconds
    await send()
    const oddsTimer = setInterval(() => { void send() }, ODDS_INTERVAL_MS)

    // ── Heartbeat ───────────────────────────────────────────────────────────
    // Re-check exclusion status every 5 minutes so a newly excluded user is
    // disconnected promptly even if their session is still open.
    const heartbeatTimer = setInterval(async () => {
      try {
        if (await isSelfExcluded(userId, fastify.redis, fastify.prisma)) {
          fastify.log.info({ userId }, 'Closing WebSocket — user self-excluded')
          socket.close(1008, 'Self-excluded')
        }
      } catch (err) {
        fastify.log.error(err, 'Heartbeat self-exclusion check failed')
      }
    }, HEARTBEAT_INTERVAL_MS)

    // ── Cleanup ─────────────────────────────────────────────────────────────
    socket.on('close', () => {
      clearInterval(oddsTimer)
      clearInterval(heartbeatTimer)
      fastify.log.info({ userId }, 'WebSocket odds connection closed')
    })

    // Server is the sole source of truth — all client messages are discarded
    socket.on('message', () => { /* intentionally ignored */ })
  })
}

export default oddsRoute
