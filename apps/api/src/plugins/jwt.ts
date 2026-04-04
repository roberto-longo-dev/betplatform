import fp from 'fastify-plugin'
import jwt from '@fastify/jwt'
import { type FastifyPluginAsync } from 'fastify'
import { config } from '../config'

const jwtPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(jwt, {
    secret: config.jwt.secret,
  })
}

export default fp(jwtPlugin, { name: 'jwt' })
