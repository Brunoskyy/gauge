import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '../src/generated/prisma/client'
import { generate } from '../src/lib/seed/generate'

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})
const BATCH = 5000

/**
 * The data ends at the start of today (UTC), or at SEED_NOW when set, so two
 * runs on the same day produce the same numbers and a re-run is a no-op for
 * the dashboards. The reset and the insert are one transaction: a reader
 * during a reseed sees the old data or the new, never an empty table.
 */
function seedNow(): Date {
  const env = process.env.SEED_NOW
  if (env) return new Date(env)
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

async function main() {
  const started = performance.now()
  const now = seedNow()
  const { users, events } = generate({ now })
  console.log(
    `generated ${users.length} users and ${events.length} events up to ${now.toISOString()}`,
  )

  await db.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('TRUNCATE TABLE events, users RESTART IDENTITY')
      await tx.user.createMany({ data: users })
      for (let i = 0; i < events.length; i += BATCH) {
        await tx.event.createMany({ data: events.slice(i, i + BATCH) })
        if ((i / BATCH) % 10 === 9) console.log(`  ${i + BATCH} events`)
      }
    },
    { timeout: 180_000 },
  )
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
