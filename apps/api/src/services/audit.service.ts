import { type PrismaClient } from '@prisma/client'

/**
 * String enum so values are readable in the database and in logs.
 * Using a regular enum (not const enum) for compatibility with tsx/esbuild.
 */
export enum AuditAction {
  LOGIN               = 'LOGIN',
  LOGOUT              = 'LOGOUT',
  REGISTER            = 'REGISTER',
  REFRESH_TOKEN       = 'REFRESH_TOKEN',
  SELF_EXCLUSION      = 'SELF_EXCLUSION',
  DEPOSIT_LIMIT_SET   = 'DEPOSIT_LIMIT_SET',
  DEPOSIT_LIMIT_PENDING = 'DEPOSIT_LIMIT_PENDING',
  SESSION_TIMEOUT     = 'SESSION_TIMEOUT',
  FAILED_LOGIN        = 'FAILED_LOGIN',
  TOKEN_REVOKED       = 'TOKEN_REVOKED',
}

export interface AuditLogEntry {
  /** Optional: FAILED_LOGIN for an unknown email has no userId — DB write is skipped. */
  userId?: string
  action: AuditAction
  amount?: number
  balanceBefore?: number
  balanceAfter?: number
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

export class AuditService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Fire-and-forget — callers use: void this.audit.log({ ... })
   * Never throws. Errors are caught and emitted as console.warn so that
   * an audit write failure never breaks the calling operation.
   */
  async log(entry: AuditLogEntry): Promise<void> {
    if (!entry.userId) {
      // Cannot persist without a userId FK — surface to stderr for monitoring
      console.warn('[audit] skipped DB write (no userId):', JSON.stringify(entry))
      return
    }
    try {
      await this.prisma.auditLog.create({
        data: {
          userId:        entry.userId,
          action:        entry.action,
          amount:        entry.amount,
          balanceBefore: entry.balanceBefore,
          balanceAfter:  entry.balanceAfter,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          metadata:      entry.metadata as any,
          ipAddress:     entry.ipAddress,
          userAgent:     entry.userAgent,
        },
      })
    } catch (err) {
      console.warn('[audit] failed to write log entry:', err)
    }
  }
}
