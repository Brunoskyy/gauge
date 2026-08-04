import 'server-only'

import { Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'
import type { Breakdown, Bucket, DateRange } from '@/lib/params'

import { timed } from './timed'

export interface Kpis {
  activeUsers: number
  events: number
  sessions: number
  signups: number
  /** Users who signed up in the range and shared something afterwards. */
  converted: number
}

/**
 * One pass over the range for the counts, one correlated count for the
 * funnel end. Everything is COUNT over an index range on ts; see the README
 * for the plan.
 */
export async function kpis(from: Date, to: Date): Promise<Kpis> {
  const rows = await db.$queryRaw<
    Array<{ active_users: bigint; events: bigint; sessions: bigint }>
  >(Prisma.sql`
    SELECT count(DISTINCT user_id) AS active_users,
           count(*)                AS events,
           count(DISTINCT session_id) AS sessions
    FROM events
    WHERE ts >= ${from} AND ts < ${to}
  `)
  const funnel = await db.$queryRaw<Array<{ signups: bigint; converted: bigint }>>(Prisma.sql`
    SELECT count(*) AS signups,
           count(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM events e
             WHERE e.user_id = u.id AND e.name = 'shared' AND e.ts >= u.signed_up_at
           )) AS converted
    FROM users u
    WHERE u.signed_up_at >= ${from} AND u.signed_up_at < ${to}
  `)
  const r = rows[0]
  const f = funnel[0]
  return {
    activeUsers: Number(r?.active_users ?? 0),
    events: Number(r?.events ?? 0),
    sessions: Number(r?.sessions ?? 0),
    signups: Number(f?.signups ?? 0),
    converted: Number(f?.converted ?? 0),
  }
}

export function kpisWithPrevious(range: DateRange) {
  return timed(async () => {
    const [current, previous] = await Promise.all([
      kpis(range.from, range.to),
      kpis(range.previousFrom, range.previousTo),
    ])
    return { current, previous }
  })
}

export interface SeriesPoint {
  t: Date
  events: number
  users: number
}

/**
 * Events per bucket. generate_series fills the empty buckets so the chart
 * shows a quiet day as zero rather than skipping it.
 */
export function timeseries(range: DateRange, bucket: Bucket) {
  const unit = bucket === 'hour' ? Prisma.sql`'1 hour'::interval` : Prisma.sql`'1 day'::interval`
  const trunc = bucket === 'hour' ? Prisma.sql`'hour'` : Prisma.sql`'day'`
  return timed(async () => {
    const rows = await db.$queryRaw<Array<{ t: Date; events: bigint; users: bigint }>>(Prisma.sql`
      WITH buckets AS (
        SELECT generate_series(
          date_trunc(${trunc}, ${range.from}::timestamptz),
          ${range.to}::timestamptz - ${unit},
          ${unit}
        ) AS t
      ),
      counts AS (
        SELECT date_trunc(${trunc}, ts) AS t, count(*) AS events, count(DISTINCT user_id) AS users
        FROM events
        WHERE ts >= ${range.from} AND ts < ${range.to}
        GROUP BY 1
      )
      SELECT b.t, coalesce(c.events, 0) AS events, coalesce(c.users, 0) AS users
      FROM buckets b LEFT JOIN counts c ON c.t = b.t
      ORDER BY b.t
    `)
    return rows.map((r): SeriesPoint => ({
      t: r.t,
      events: Number(r.events),
      users: Number(r.users),
    }))
  })
}

export interface BreakdownRow {
  key: string
  events: number
  users: number
}

/** Events and distinct users per country or plan, largest first. */
export function breakdown(range: DateRange, by: Breakdown) {
  const column = by === 'plan' ? Prisma.sql`u.plan::text` : Prisma.sql`u.country`
  return timed(async () => {
    const rows = await db.$queryRaw<
      Array<{ key: string; events: bigint; users: bigint }>
    >(Prisma.sql`
      SELECT ${column} AS key, count(*) AS events, count(DISTINCT e.user_id) AS users
      FROM events e JOIN users u ON u.id = e.user_id
      WHERE e.ts >= ${range.from} AND e.ts < ${range.to}
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT 12
    `)
    return rows.map((r): BreakdownRow => ({
      key: r.key,
      events: Number(r.events),
      users: Number(r.users),
    }))
  })
}
