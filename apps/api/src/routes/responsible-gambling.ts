import { type FastifyPluginAsync } from 'fastify'
import { sessionGuard } from '../middleware/session-guard'
import {
  ResponsibleGamblingService,
  type ExclusionDuration,
  type DepositPeriod,
} from '../services/responsible-gambling.service'

interface SelfExcludeBody {
  duration: ExclusionDuration
}

interface DepositLimitBody {
  amount: number
  period: DepositPeriod
}

const EXCLUSION_DURATIONS: ExclusionDuration[] = ['24h', '7d', '30d', '6m', '1y', 'permanent']
const DEPOSIT_PERIODS: DepositPeriod[] = ['daily', 'weekly', 'monthly']

const errorResponse = {
  type: 'object',
  required: ['statusCode', 'error', 'message'],
  properties: {
    statusCode: { type: 'number' },
    error: { type: 'string' },
    message: { type: 'string' },
  },
}

const rgRoute: FastifyPluginAsync = async (fastify) => {
  // Session guard applies to every route in this plugin
  fastify.addHook('preHandler', sessionGuard)

  const service = new ResponsibleGamblingService(fastify.prisma, fastify.redis)

  // ── POST /responsible-gambling/self-exclude ──────────────────────────────
  fastify.post<{ Body: SelfExcludeBody }>('/self-exclude', {
    schema: {
      tags: ['Responsible Gambling'],
      summary: 'Self-exclusion',
      description:
        'Immediately excludes the user for the requested duration. ' +
        'All active tokens are revoked and all sessions are terminated. ' +
        'For permanent exclusions, excludedUntil is null.',
      body: {
        type: 'object',
        required: ['duration'],
        properties: {
          duration: { type: 'string', enum: EXCLUSION_DURATIONS },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            excludedUntil: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        401: errorResponse,
        422: errorResponse,
      },
    },
    handler: async (request, reply) => {
      const { sub: userId } = await request.jwtVerify<{ sub: string }>()
      const { excludedUntil } = await service.selfExclude(
        userId,
        request.body.duration,
        request.ip,
      )
      return reply.code(200).send({ excludedUntil })
    },
  })

  // ── POST /responsible-gambling/deposit-limit ─────────────────────────────
  fastify.post<{ Body: DepositLimitBody }>('/deposit-limit', {
    schema: {
      tags: ['Responsible Gambling'],
      summary: 'Set deposit limit',
      description:
        'Sets or updates the deposit limit. ' +
        'Decreases apply immediately (202 with applied:true). ' +
        'Increases are staged for 7 days as required by responsible gambling regulation ' +
        '(202 with applied:false and pendingFrom date).',
      body: {
        type: 'object',
        required: ['amount', 'period'],
        properties: {
          amount: { type: 'number', minimum: 1 },
          period: { type: 'string', enum: DEPOSIT_PERIODS },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            applied: { type: 'boolean' },
            pendingFrom: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        401: errorResponse,
        422: errorResponse,
      },
    },
    handler: async (request, reply) => {
      const { sub: userId } = await request.jwtVerify<{ sub: string }>()
      const result = await service.setDepositLimit(
        userId,
        request.body.amount,
        request.body.period,
      )
      return reply.code(200).send(result)
    },
  })

  // ── GET /responsible-gambling/status ─────────────────────────────────────
  fastify.get('/status', {
    schema: {
      tags: ['Responsible Gambling'],
      summary: 'Responsible gambling status',
      description:
        'Returns the current responsible gambling status for the authenticated user: ' +
        'exclusion state, active session duration in seconds, and deposit limit.',
      response: {
        200: {
          type: 'object',
          properties: {
            selfExcluded: { type: 'boolean' },
            excludedUntil: { type: 'string', format: 'date-time', nullable: true },
            sessionDurationSeconds: { type: 'number', nullable: true },
            depositLimit: {
              nullable: true,
              type: 'object',
              properties: {
                amount: { type: 'number' },
                period: { type: 'string' },
                pendingAmount: { type: 'number', nullable: true },
                pendingFrom: { type: 'string', format: 'date-time', nullable: true },
              },
            },
          },
        },
        401: errorResponse,
      },
    },
    handler: async (request, reply) => {
      const { sub: userId } = await request.jwtVerify<{ sub: string }>()
      const status = await service.getStatus(userId)
      return reply.code(200).send(status)
    },
  })
}

export default rgRoute
