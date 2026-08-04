import 'server-only'

import { Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'
import type { DateRange, ExplorerFilters } from '@/lib/params'

import { timed } from './timed'

export interface EventRow {
  id: bigint
  name: string
  userId: string
  sessionId: string
  ts: Date
  props: Record<string, unknown>
  plan: string
  country: string
}

export const PAGE_SIZE = 100

/**
 * Filters compose as SQL fragments joined with AND; every value is a bound
 * parameter. The page is keyset-paginated on (ts, id) descending, so page
 * fifty costs the same as page one and a row inserted meanwhile cannot shift
 * the others.
 */
export function buildWhere(range: DateRange, f: ExplorerFilters): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`e.ts >= ${range.from} AND e.ts < ${range.to}`]
  if (f.events.length) parts.push(Prisma.sql`e.name IN (${Prisma.join(f.events)})`)
  if (f.plans.length) parts.push(Prisma.sql`u.plan::text IN (${Prisma.join(f.plans)})`)
  if (f.countries.length) parts.push(Prisma.sql`u.country IN (${Prisma.join(f.countries)})`)
  if (f.props) parts.push(Prisma.sql`e.props @> ${JSON.stringify(f.props)}::jsonb`)
  if (f.cursor) parts.push(Prisma.sql`(e.ts, e.id) < (${f.cursor.ts}, ${f.cursor.id})`)
  return Prisma.join(parts, ' AND ')
}

export function listEvents(range: DateRange, f: ExplorerFilters, limit = PAGE_SIZE) {
  return timed(async () => {
    const rows = await db.$queryRaw<
      Array<{
        id: bigint
        name: string
        user_id: string
        session_id: string
        ts: Date
        props: Record<string, unknown>
        plan: string
        country: string
      }>
    >(Prisma.sql`
      SELECT e.id, e.name, e.user_id, e.session_id, e.ts, e.props, u.plan::text AS plan, u.country
      FROM events e JOIN users u ON u.id = e.user_id
      WHERE ${buildWhere(range, f)}
      ORDER BY e.ts DESC, e.id DESC
      LIMIT ${limit + 1}
    `)
    const page = rows.slice(0, limit).map((r): EventRow => ({
      id: r.id,
      name: r.name,
      userId: r.user_id,
      sessionId: r.session_id,
      ts: r.ts,
      props: r.props,
      plan: r.plan,
      country: r.country,
    }))
    return { rows: page, hasMore: rows.length > limit }
  })
}

/** Matching row count, capped so a broad filter does not scan everything. */
export function countEvents(range: DateRange, f: ExplorerFilters, cap = 100_000) {
  return timed(async () => {
    const rows = await db.$queryRaw<Array<{ n: bigint }>>(Prisma.sql`
      SELECT count(*) AS n FROM (
        SELECT 1 FROM events e JOIN users u ON u.id = e.user_id
        WHERE ${buildWhere(range, { ...f, cursor: null })}
        LIMIT ${cap}
      ) capped
    `)
    const n = Number(rows[0]?.n ?? 0)
    return { count: n, capped: n >= cap }
  })
}

/** Pages through every matching row, oldest cursor last; used by the CSV export. */
export async function* iterateEvents(
  range: DateRange,
  f: ExplorerFilters,
): AsyncGenerator<EventRow[]> {
  let cursor = f.cursor
  for (;;) {
    const { data } = await listEvents(range, { ...f, cursor }, 1000)
    if (data.rows.length === 0) return
    yield data.rows
    if (!data.hasMore) return
    const last = data.rows[data.rows.length - 1]!
    cursor = { ts: last.ts, id: last.id }
  }
}

export function distinctCountries() {
  return timed(async () => {
    const rows = await db.$queryRaw<Array<{ country: string }>>(Prisma.sql`
      SELECT country FROM users GROUP BY country ORDER BY count(*) DESC
    `)
    return rows.map((r) => r.country)
  })
}
