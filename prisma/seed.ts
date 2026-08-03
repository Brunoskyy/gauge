import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '../src/generated/prisma/client'
import { generate } from '../src/lib/seed/generate'

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})
const BATCH = 5000

async function main() {
  const started = performance.now()
  const { users, events } = generate()
  console.log(`generated ${users.length} users and ${events.length} events`)

  await db.event.deleteMany()
  await db.user.deleteMany()
  await db.user.createMany({ data: users })

  for (let i = 0; i < events.length; i += BATCH) {
    await db.event.createMany({ data: events.slice(i, i + BATCH) })
    if ((i / BATCH) % 10 === 9) console.log(`  ${i + BATCH} events`)
  }
  await db.$executeRawUnsafe('ANALYZE events')
  await db.$executeRawUnsafe('ANALYZE users')
  console.log(`seeded in ${((performance.now() - started) / 1000).toFixed(1)}s`)
}

main()
  .catch((e: unknown) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
