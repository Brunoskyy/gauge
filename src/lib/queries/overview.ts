import 'server-only'

import { Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'
import type { Breakdown, Bucket, DateRange } from '@/lib/params'

import { timed } from './timed'

export interface Kpis {
  activeUsers: number
  events: number
  sessions: number
  /** Signups old enough to have had the whole conversion window. */
  signups: number
  /** Of those, the ones who shared within the window. */
  converted: number
}

/**
 * Conversion is "shared within a week of signing up". A fixed window is what
 * makes two periods comparable: without it, older signups have simply had
 * more time, and every previous period looks better than the current one.
 */
export const CONVERSION_WINDOW_DAYS = 7

/**
 * One pass over the range for the counts, one correlated count for the
 * funnel end. Everything is COUNT over an index range on ts; see the README
 * for the plan.
 */
export async function kpis(from: Date, to: Date, now = new Date()): Promise<Kpis> {
  // Signups newer than the window have not had their chance yet; they are left out.
  const matureBefore = new Date(
    Math.min(to.getTime(), now.getTime() - CONVERSION_WINDOW_DAYS * 86_400_000),
  )
  const window = Prisma.sql`make_interval(days => ${CONVERSION_WINDOW_DAYS})`
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
             WHERE e.user_id = u.id AND e.name = 'shared'
               AND e.ts >= u.signed_up_at AND e.ts < u.signed_up_at + ${window}
           )) AS converted
    FROM users u
    WHERE u.signed_up_at >= ${from} AND u.signed_up_at < ${matureBefore}
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

/** Current counts run up to `effectiveTo`, so a period that ends today is compared on equal footing. */
export function kpisWithPrevious(range: DateRange, now = new Date()) {
  return timed(async () => {
    const [current, previous] = await Promise.all([
      kpis(range.from, range.effectiveTo, now),
      kpis(range.previousFrom, range.previousTo, now),
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
