import bcrypt from 'bcrypt'
import { randomBytes } from 'node:crypto'
import { type PrismaClient } from '@prisma/client'
import { type SessionService } from './session.service'

const BCRYPT_ROUNDS = 12
const REFRESH_TOKEN_BYTES = 40
const REFRESH_TOKEN_TTL_DAYS = 7

type SignFn = (
  payload: Record<string, unknown>,
  options: { expiresIn: string },
) => string

interface TokenPair {
  accessToken: string
  refreshToken: string
}

function createError(message: string, statusCode: number): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number }
  err.statusCode = statusCode
  return err
}

export class AuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly sign: SignFn,
    private readonly sessions: SessionService,
  ) {}

  async register(email: string, password: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } })
    if (existing) {
      throw createError('Email already registered', 409)
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    return this.prisma.user.create({
      data: { email, passwordHash },
      select: { id: true, email: true, createdAt: true },
    })
  }

  async login(email: string, password: string, ip: string): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({ where: { email } })

    // Always run bcrypt regardless of whether the user exists.
    // This prevents timing-based user enumeration attacks.
    const sentinel = '$2b$12$invalidhashfortimingprotectionxxxxxxxxxxxxxxxxxx00000'
    const hash = user?.passwordHash ?? sentinel
    const valid = await bcrypt.compare(password, hash)

    if (!user || !valid) {
      throw createError('Invalid credentials', 401)
    }

    const tokens = await this.issueTokens(user.id, user.email)

    await this.sessions.setSession(user.id, {
      userId: user.id,
      email: user.email,
      loginAt: new Date().toISOString(),
      ip,
    })

    return tokens
  }

  async refresh(oldToken: string): Promise<TokenPair> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: oldToken },
      include: { user: true },
    })

    if (!stored || stored.revokedAt !== null || stored.expiresAt < new Date()) {
      throw createError('Invalid or expired refresh token', 401)
    }

    // Rotate: revoke old token before issuing new pair.
    // If this token was already rotated and is being replayed by an attacker,
    // this branch catches it (revokedAt !== null check above).
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    })

    const tokens = await this.issueTokens(stored.user.id, stored.user.email)

    // Reset session TTL — user is still active
    await this.sessions.extendSession(stored.user.id)

    return tokens
  }

  async logout(token: string): Promise<void> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token },
    })

    if (!stored || stored.revokedAt !== null) {
      throw createError('Invalid refresh token', 401)
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    })

    await this.sessions.deleteSession(stored.userId)
  }

  private async issueTokens(userId: string, email: string): Promise<TokenPair> {
    const accessToken = this.sign(
      { sub: userId, email, type: 'access' },
      { expiresIn: '15m' },
    )

    const refreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS)

    await this.prisma.refreshToken.create({
      data: { token: refreshToken, userId, expiresAt },
    })

    return { accessToken, refreshToken }
  }
}
