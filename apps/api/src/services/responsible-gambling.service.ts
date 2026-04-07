import { type PrismaClient } from '@prisma/client'
import { type Redis } from 'ioredis'
import { AuditAction } from './audit.service'

// '2m' is a demo-only duration so recruiters can observe the full self-exclusion
// flow (block on login, Redis eviction, WebSocket close) without waiting 24 hours.
// A production platform would remove '2m' and keep only real regulatory durations.
export type ExclusionDuration = '2m' | '24h' | '7d' | '30d' | '6m' | '1y' | 'permanent'
export type DepositPeriod = 'daily' | 'weekly' | 'monthly'

const COOLING_OFF_DAYS = 7

function resolveExclusionEnd(duration: ExclusionDuration): Date | null {
  const now = new Date()
  switch (duration) {
    case '2m':  return new Date(now.getTime() + 2 * 60 * 1_000) // demo only
    case '24h': return new Date(now.getTime() + 24 * 60 * 60 * 1_000)
    case '7d':  return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1_000)
    case '30d': return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1_000)
    case '6m': {
      const d = new Date(now)
      d.setMonth(d.getMonth() + 6)
      return d
    }
    case '1y': {
      const d = new Date(now)
      d.setFullYear(d.getFullYear() + 1)
      return d
    }
    case 'permanent': return null
  }
}

export class ResponsibleGamblingService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
  ) {}

  /**
   * Self-exclusion: atomically marks the user excluded, revokes all tokens,
   * ends all sessions, writes an audit log entry, and clears Redis state.
   */
  async selfExclude(
    userId: string,
    duration: ExclusionDuration,
    ipAddress: string,
  ): Promise<{ excludedUntil: Date | null }> {
    const excludedUntil = resolveExclusionEnd(duration)
    const now = new Date()

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { selfExcluded: true, excludedUntil },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.prisma.userSession.updateMany({
        where: { userId, endedAt: null },
        data: { endedAt: now },
      }),
      this.prisma.auditLog.create({
        data: {
          userId,
          action: AuditAction.SELF_EXCLUSION,
          ipAddress,
          metadata: {
            duration,
            excludedUntil: excludedUntil?.toISOString() ?? 'permanent',
          },
        },
      }),
    ])

    // Clear Redis: session + cached exclusion flag so the new status
    // is picked up immediately by the WebSocket heartbeat.
    await Promise.all([
      this.redis.del(`session:${userId}`),
      this.redis.del(`excluded:${userId}`),
    ])

    return { excludedUntil }
  }

  /**
   * Deposit limit management with 7-day cooling-off for increases.
   * Decreases apply immediately; increases are staged in pendingAmount/pendingFrom.
   */
  async setDepositLimit(
    userId: string,
    amount: number,
    period: DepositPeriod,
  ): Promise<{ applied: true } | { applied: false; pendingFrom: Date }> {
    const existing = await this.prisma.depositLimit.findUnique({ where: { userId } })
    const now = new Date()

    const isDecrease = !existing || amount <= existing.amount.toNumber()

    if (isDecrease) {
      await this.prisma.$transaction([
        this.prisma.depositLimit.upsert({
          where: { userId },
          create: { userId, amount, period },
          update: { amount, period, pendingAmount: null, pendingFrom: null },
        }),
        this.prisma.auditLog.create({
          data: {
            userId,
            action: AuditAction.DEPOSIT_LIMIT_SET,
            amount,
            metadata: { period },
          },
        }),
      ])
      return { applied: true }
    }

    // Increase → cooling-off period
    const pendingFrom = new Date(now.getTime() + COOLING_OFF_DAYS * 24 * 60 * 60 * 1_000)

    await this.prisma.$transaction([
      this.prisma.depositLimit.upsert({
        where: { userId },
        create: {
          userId,
          amount: existing?.amount ?? amount,
          period: existing?.period ?? period,
          pendingAmount: amount,
          pendingFrom,
        },
        update: { pendingAmount: amount, pendingFrom },
      }),
      this.prisma.auditLog.create({
        data: {
          userId,
          action: AuditAction.DEPOSIT_LIMIT_PENDING,
          amount,
          metadata: { period, pendingFrom: pendingFrom.toISOString() },
        },
      }),
    ])

    return { applied: false, pendingFrom }
  }

  async getStatus(userId: string) {
    const [user, depositLimit, rawSession] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { selfExcluded: true, excludedUntil: true },
      }),
      this.prisma.depositLimit.findUnique({ where: { userId } }),
      this.redis.get(`session:${userId}`),
    ])

    let sessionDurationSeconds: number | null = null
    if (rawSession) {
      const { loginAt } = JSON.parse(rawSession) as { loginAt: string }
      sessionDurationSeconds = Math.floor((Date.now() - new Date(loginAt).getTime()) / 1_000)
    }

    return {
      selfExcluded: user?.selfExcluded ?? false,
      excludedUntil: user?.excludedUntil ?? null,
      sessionDurationSeconds,
      depositLimit: depositLimit
        ? {
            amount: depositLimit.amount.toNumber(),
            period: depositLimit.period,
            pendingAmount: depositLimit.pendingAmount?.toNumber() ?? null,
            pendingFrom: depositLimit.pendingFrom ?? null,
          }
        : null,
    }
  }
}
