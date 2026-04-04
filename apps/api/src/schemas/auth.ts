/**
 * JSON Schema definitions for auth endpoints.
 * These serve dual purpose: Fastify validates incoming requests against them,
 * and @fastify/swagger uses them to generate OpenAPI documentation.
 * One schema, zero drift between validation and docs.
 */

export const registerBody = {
  type: 'object',
  required: ['email', 'password'],
  additionalProperties: false,
  properties: {
    email: {
      type: 'string',
      format: 'email',
      description: 'User email address',
    },
    password: {
      type: 'string',
      minLength: 8,
      maxLength: 72,
      description: 'Password — 8 to 72 characters (bcrypt upper limit)',
    },
  },
} as const

export const loginBody = {
  type: 'object',
  required: ['email', 'password'],
  additionalProperties: false,
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string' },
  },
} as const

export const refreshBody = {
  type: 'object',
  required: ['refreshToken'],
  additionalProperties: false,
  properties: {
    refreshToken: {
      type: 'string',
      description: 'Opaque refresh token received at login or last rotation',
    },
  },
} as const

export const tokenPairResponse = {
  type: 'object',
  required: ['accessToken', 'refreshToken'],
  properties: {
    accessToken: {
      type: 'string',
      description: 'Signed JWT — valid for 15 minutes',
    },
    refreshToken: {
      type: 'string',
      description: 'Opaque token — valid for 7 days, single-use (rotated on each refresh)',
    },
  },
} as const

export const errorResponse = {
  type: 'object',
  required: ['statusCode', 'error', 'message'],
  properties: {
    statusCode: { type: 'number' },
    error: { type: 'string' },
    message: { type: 'string' },
  },
} as const
