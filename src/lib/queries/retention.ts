import 'server-only'

import { Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'
import type { DateRange } from '@/lib/params'
import { shapeRetention, type CohortSize, type RetentionRow } from '@/lib/retention'

import { timed } from './timed'

/**
 * Weekly cohorts: everyone who signed up in a given week (Monday, UTC) and,
 * for each week after, how many of them did anything other than sign up.
 * The join runs on (user_id, ts), the distinct on (user, week) keeps a busy
 * user from counting twice, and the shaping into a triangle happens in TS.
 */
export function retention(range: DateRange, now = new Date()) {
  return timed(async () => {
    const [rows, sizes] = await Promise.all([
      db.$queryRaw<Array<{ cohort: Date; week_no: number; users: bigint }>>(Prisma.sql`
        WITH cohorts AS (
          SELECT id, date_trunc('week', signed_up_at) AS cohort
          FROM users
          WHERE signed_up_at >= ${range.from} AND signed_up_at < ${range.to}
        ),
        activity AS (
          SELECT DISTINCT c.cohort, e.user_id, date_trunc('week', e.ts) AS week
          FROM events e JOIN cohorts c ON c.id = e.user_id
          WHERE e.name <> 'signup' AND e.ts >= ${range.from}
        )
        SELECT cohort,
               (extract(epoch FROM (week - cohort)) / 604800)::int AS week_no,
               count(*) AS users
        FROM activity
        GROUP BY 1, 2
        HAVING (extract(epoch FROM (week - cohort)) / 604800)::int > 0
        ORDER BY 1, 2
      `),
      db.$queryRaw<Array<{ cohort: Date; size: bigint }>>(Prisma.sql`
        SELECT date_trunc('week', signed_up_at) AS cohort, count(*) AS size
        FROM users
        WHERE signed_up_at >= ${range.from} AND signed_up_at < ${range.to}
        GROUP BY 1 ORDER BY 1
      `),
    ])
    const long: RetentionRow[] = rows.map((r) => ({
      cohort: r.cohort,
      weekNo: r.week_no,
      users: Number(r.users),
    }))
    const cohortSizes: CohortSize[] = sizes.map((r) => ({ cohort: r.cohort, size: Number(r.size) }))
    return shapeRetention(long, cohortSizes, now)
  })
}
