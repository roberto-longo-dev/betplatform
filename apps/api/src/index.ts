import 'dotenv/config'
import { buildApp } from './app'
import { config } from './config'

async function start() {
  const app = await buildApp()

  try {
    const address = await app.listen({
      port: config.server.port,
      host: config.server.host,
    })
    app.log.info(`Server listening at ${address}`)
    app.log.info(`API docs available at ${address}/docs`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
