import type { Redis } from 'ioredis'

const SESSION_PREFIX = 'session:'
const DEFAULT_TTL_SECONDS = 24 * 60 * 60 // 24 hours

export interface SessionData {
  userId: string
  email: string
  loginAt: string
  ip: string
}

export class SessionService {
  constructor(private readonly redis: Redis) {}

  async setSession(
    userId: string,
    data: SessionData,
    ttlSeconds = DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    await this.redis.set(
      SESSION_PREFIX + userId,
      JSON.stringify(data),
      'EX',
      ttlSeconds,
    )
  }

  async getSession(userId: string): Promise<SessionData | null> {
    const raw = await this.redis.get(SESSION_PREFIX + userId)
    if (!raw) return null
    return JSON.parse(raw) as SessionData
  }

  async deleteSession(userId: string): Promise<void> {
    await this.redis.del(SESSION_PREFIX + userId)
  }

  async extendSession(
    userId: string,
    ttlSeconds = DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    await this.redis.expire(SESSION_PREFIX + userId, ttlSeconds)
  }
}
