import 'server-only'

import { Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'
import { shapeFunnel } from '@/lib/funnel'
import type { DateRange } from '@/lib/params'

import { timed } from './timed'

/**
 * An ordered funnel: a user counts for step n only with an event of that
 * name after their step n-1 event. Each step is a CTE built from the one
 * before, so the SQL is composed from fragments, but every name is still a
 * bound parameter.
 */
export function funnel(range: DateRange, steps: string[]) {
  return timed(async () => {
    const ctes: Prisma.Sql[] = []
    steps.forEach((name, i) => {
      const alias = Prisma.raw(`s${i}`)
      if (i === 0) {
        ctes.push(Prisma.sql`${alias} AS (
          SELECT user_id, min(ts) AS ts FROM events
          WHERE name = ${name} AND ts >= ${range.from} AND ts < ${range.to}
          GROUP BY user_id)`)
      } else {
        const prev = Prisma.raw(`s${i - 1}`)
        ctes.push(Prisma.sql`${alias} AS (
          SELECT e.user_id, min(e.ts) AS ts FROM events e
          JOIN ${prev} p ON p.user_id = e.user_id AND e.ts > p.ts
          WHERE e.name = ${name} AND e.ts < ${range.to}
          GROUP BY e.user_id)`)
      }
    })
    // Each count gets its own alias: duplicate column names collapse into one key.
    const selects = steps.map(
      (_, i) => Prisma.sql`(SELECT count(*) FROM ${Prisma.raw(`s${i}`)}) AS ${Prisma.raw(`c${i}`)}`,
    )
    const rows = await db.$queryRaw<Array<Record<string, bigint>>>(Prisma.sql`
      WITH ${Prisma.join(ctes, ', ')}
      SELECT ${Prisma.join(selects, ', ')}
    `)
    const row = rows[0] ?? {}
    const counts = steps.map((_, i) => Number(row[`c${i}`] ?? 0))
    return shapeFunnel(steps, counts)
  })
}
