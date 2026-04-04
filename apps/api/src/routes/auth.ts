import { type FastifyPluginAsync } from 'fastify'
import { AuthService } from '../services/auth.service'
import {
  registerBody,
  loginBody,
  refreshBody,
  tokenPairResponse,
  errorResponse,
} from '../schemas/auth'

interface RegisterBody { email: string; password: string }
interface LoginBody { email: string; password: string }
interface RefreshBody { refreshToken: string }

// Auth routes are stricter than the global 100 req/min limit
const AUTH_RATE_LIMIT = { max: 5, timeWindow: '1 minute' }

const authRoute: FastifyPluginAsync = async (fastify) => {
  const service = new AuthService(
    fastify.prisma,
    (payload, opts) => fastify.jwt.sign(payload, opts),
  )

  fastify.post<{ Body: RegisterBody }>('/register', {
    config: { rateLimit: AUTH_RATE_LIMIT },
    schema: {
      tags: ['Auth'],
      summary: 'Register a new account',
      description: 'Creates a new user account. Returns the created user (password excluded).',
      body: registerBody,
      response: {
        201: {
          type: 'object',
          required: ['id', 'email', 'createdAt'],
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        409: errorResponse,
        422: errorResponse,
      },
    },
    handler: async (request, reply) => {
      const user = await service.register(request.body.email, request.body.password)
      return reply.code(201).send(user)
    },
  })

  fastify.post<{ Body: LoginBody }>('/login', {
    config: { rateLimit: AUTH_RATE_LIMIT },
    schema: {
      tags: ['Auth'],
      summary: 'Login',
      description:
        'Validates credentials and returns a JWT access token (15 min) and an opaque refresh token (7 days).',
      body: loginBody,
      response: {
        200: tokenPairResponse,
        401: errorResponse,
      },
    },
    handler: async (request, reply) => {
      const tokens = await service.login(request.body.email, request.body.password)
      return reply.code(200).send(tokens)
    },
  })

  fastify.post<{ Body: RefreshBody }>('/refresh', {
    config: { rateLimit: AUTH_RATE_LIMIT },
    schema: {
      tags: ['Auth'],
      summary: 'Rotate refresh token',
      description:
        'Consumes the provided refresh token and issues a new access/refresh pair. ' +
        'The submitted token is immediately revoked — it cannot be used again.',
      body: refreshBody,
      response: {
        200: tokenPairResponse,
        401: errorResponse,
      },
    },
    handler: async (request, reply) => {
      const tokens = await service.refresh(request.body.refreshToken)
      return reply.code(200).send(tokens)
    },
  })

  fastify.post<{ Body: RefreshBody }>('/logout', {
    config: { rateLimit: AUTH_RATE_LIMIT },
    schema: {
      tags: ['Auth'],
      summary: 'Logout',
      description:
        'Revokes the provided refresh token server-side. ' +
        'The access token expires naturally after 15 minutes.',
      body: refreshBody,
      response: {
        204: {
          type: 'null',
          description: 'Successfully logged out',
        },
        401: errorResponse,
      },
    },
    handler: async (request, reply) => {
      await service.logout(request.body.refreshToken)
      return reply.code(204).send()
    },
  })
}

export default authRoute
