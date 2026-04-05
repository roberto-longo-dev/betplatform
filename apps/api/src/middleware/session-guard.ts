import { type FastifyRequest, type FastifyReply } from 'fastify'
import { AuditService, AuditAction } from '../services/audit.service'

const SESSION_LIMIT_MS = 4 * 60 * 60 * 1_000 // 4 hours

/**
 * preHandler hook for protected routes.
 *
 * Enforces a maximum continuous gambling session of 4 hours. On expiry it
 * revokes all active refresh tokens, ends the DB session, deletes the Redis
 * session, and returns 401 with a responsible-gambling message.
 *
 * Redis is the fast path; PostgreSQL UserSession is the authoritative fallback
 * for cases where the Redis key has expired but the JWT is still valid.
 */
export async function sessionGuard(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  let userId: string
  try {
    const payload = await request.jwtVerify<{ sub: string }>()
    userId = payload.sub
  } catch {
    // No valid JWT — let the route handler produce the proper 401
    return
  }

  const loginAt = await resolveLoginAt(userId, request)
  if (!loginAt) return // No trackable session — cannot enforce timeout

  const durationMs = Date.now() - loginAt.getTime()
  if (durationMs < SESSION_LIMIT_MS) return

  // ── Session limit reached — force logout ────────────────────────────────
  const now = new Date()

  await Promise.all([
    request.server.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    }),
    request.server.prisma.userSession.updateMany({
      where: { userId, endedAt: null },
      data: { endedAt: now },
    }),
    request.server.redis.del(`session:${userId}`),
  ])

  void new AuditService(request.server.prisma).log({
    userId,
    action: AuditAction.SESSION_TIMEOUT,
    ipAddress: request.ip,
  })

  await reply.code(401).send({
    error: 'Session limit reached',
    code: 'SESSION_TIMEOUT',
    message: 'You have been playing for 4 hours. Please take a break.',
  })
}

async function resolveLoginAt(
  userId: string,
  request: FastifyRequest,
): Promise<Date | null> {
  // Fast path: Redis session (written on login)
  const raw = await request.server.redis.get(`session:${userId}`)
  if (raw) {
    const { loginAt } = JSON.parse(raw) as { loginAt: string }
    return new Date(loginAt)
  }

  // Fallback: most recent open PostgreSQL UserSession
  const dbSession = await request.server.prisma.userSession.findFirst({
    where: { userId, endedAt: null },
    orderBy: { startedAt: 'desc' },
    select: { startedAt: true },
  })

  return dbSession?.startedAt ?? null
}
