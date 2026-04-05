import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const email = 'demo@betplatform.dev'
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log('Demo user already exists — skipping.')
    return
  }

  const passwordHash = await bcrypt.hash('demo1234', 10)
  await prisma.user.create({ data: { email, passwordHash } })
  console.log(`Demo user created: ${email}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
