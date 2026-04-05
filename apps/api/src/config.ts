/**
 * Centralised config — validated at startup.
 * Import this module after dotenv has been loaded (done in index.ts).
 */

function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Missing required environment variable: ${key}`)
  return value
}

export const config = {
  database: {
    url: requireEnv('DATABASE_URL'),
  },
  redis: {
    url: requireEnv('REDIS_URL'),
  },
  jwt: {
    secret: requireEnv('JWT_SECRET'),
  },
  server: {
    port: parseInt(process.env['PORT'] ?? '3001', 10),
    host: process.env['HOST'] ?? '0.0.0.0',
    logLevel: process.env['LOG_LEVEL'] ?? 'info',
  },
}
