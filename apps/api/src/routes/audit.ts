import { type FastifyPluginAsync } from 'fastify'

const auditRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/log', {
    schema: {
      tags: ['Audit'],
      summary: 'Audit log',
      description:
        'Returns the 50 most recent audit log entries for the authenticated user, ' +
        'along with the total count of all entries.',
      response: {
        200: {
          type: 'object',
          required: ['logs', 'total'],
          properties: {
            total: { type: 'number' },
            logs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id:         { type: 'string' },
                  action:     { type: 'string' },
                  amount:     { type: 'number', nullable: true },
                  ipAddress:  { type: 'string', nullable: true },
                  metadata:   { nullable: true },
                  createdAt:  { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        401: {
          type: 'object',
          required: ['statusCode', 'error', 'message'],
          properties: {
            statusCode: { type: 'number' },
            error:      { type: 'string' },
            message:    { type: 'string' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { sub: userId } = await request.jwtVerify<{ sub: string }>()

      const [entries, total] = await Promise.all([
        fastify.prisma.auditLog.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            id:        true,
            action:    true,
            amount:    true,
            ipAddress: true,
            metadata:  true,
            createdAt: true,
          },
        }),
        fastify.prisma.auditLog.count({ where: { userId } }),
      ])

      return reply.code(200).send({
        total,
        logs: entries.map((e) => ({
          ...e,
          amount: e.amount?.toNumber() ?? null,
        })),
      })
    },
  })
}

export default auditRoute
