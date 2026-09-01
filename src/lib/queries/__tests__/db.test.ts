// @vitest-environment node
import 'dotenv/config'
import { describe, expect, it } from 'vitest'

import { parseRange } from '@/lib/params'

/**
 * Runs against the seeded database only when asked for with GAUGE_DB_TESTS=1
 * (and DATABASE_URL set); a `.env` alone does not mean Postgres is up, and
 * `npm test` has to pass on a laptop with the database stopped. The numbers
 * below come from the deterministic seed, so they are exact.
 */
const enabled = process.env.GAUGE_DB_TESTS === '1' && Boolean(process.env.DATABASE_URL)
const now = new Date()

describe.skipIf(!enabled)('queries against the seeded database', () => {
  it('counts events in a range and fills empty buckets', async () => {
    const { timeseries, kpis } = await import('../overview')
    const range = parseRange({ range: '7d' }, now)
    const { data } = await timeseries(range, 'day')
    expect(data).toHaveLength(7)
    const total = data.reduce((s, p) => s + p.events, 0)
    const k = await kpis(range.from, range.to)
    expect(k.events).toBe(total)
    expect(k.activeUsers).toBeGreaterThan(0)
    expect(k.sessions).toBeLessThanOrEqual(k.events)
    const hours = await timeseries(range, 'hour')
    expect(hours.data.length).toBe(7 * 24)
    expect(hours.data.reduce((s, p) => s + p.events, 0)).toBe(total)
  })

  it('breaks down by plan with three rows', async () => {
    const { breakdown } = await import('../overview')
    const { data } = await breakdown(parseRange({ range: '30d' }, now), 'plan')
    expect(data.map((r) => r.key).sort()).toEqual(['business', 'free', 'team'])
    expect(data[0]!.events).toBeGreaterThanOrEqual(data[1]!.events)
  })

  it('paginates the explorer by keyset without overlap', async () => {
    const { listEvents } = await import('../events')
    const { parseExplorer } = await import('@/lib/params')
    const range = parseRange({ range: '30d' }, now)
    const filters = parseExplorer({ event: 'shared', q: 'channel=link' })
    const first = await listEvents(range, filters, 50)
    expect(first.data.rows).toHaveLength(50)
    expect(first.data.rows.every((r) => r.name === 'shared' && r.props.channel === 'link')).toBe(
      true,
    )
    const last = first.data.rows[49]!
    const second = await listEvents(range, { ...filters, cursor: { ts: last.ts, id: last.id } }, 50)
    const ids = new Set(first.data.rows.map((r) => r.id))
    expect(second.data.rows.some((r) => ids.has(r.id))).toBe(false)
    expect(second.data.rows[0]!.ts.getTime()).toBeLessThanOrEqual(last.ts.getTime())
  })

  it('counts conversion only for signups old enough to have had the window', async () => {
    const { kpis, CONVERSION_WINDOW_DAYS } = await import('../overview')
    const range = parseRange({ range: '30d' }, now)
    const k = await kpis(range.from, range.to, now)
    // Pretend it is a week later: every signup in the range has matured, so the count can only grow.
    const later = new Date(now.getTime() + CONVERSION_WINDOW_DAYS * 86_400_000)
    const mature = await kpis(range.from, range.to, later)
    expect(mature.signups).toBeGreaterThanOrEqual(k.signups)
    expect(k.converted).toBeLessThanOrEqual(k.signups)
  })

  it('builds a retention triangle whose first column is the cohort size', async () => {
    const { retention } = await import('../retention')
    const { data } = await retention(parseRange({ range: '90d' }, now), now)
    expect(data.cohorts.length).toBeGreaterThan(8)
    for (const c of data.cohorts) {
      expect(c.cells[0]).toMatchObject({ users: c.size, ratio: 1 })
      for (const cell of c.cells.slice(1)) if (cell) expect(cell.ratio).toBeLessThanOrEqual(1)
    }
    // Newest cohort has fewer known weeks than the oldest.
    const known = (i: number) => data.cohorts[i]!.cells.filter((x) => x !== null).length
    expect(known(0)).toBeGreaterThan(known(data.cohorts.length - 1))
  })

  it('computes an ordered funnel that never grows', async () => {
    const { funnel } = await import('../funnel')
    const { data } = await funnel(parseRange({ range: '90d' }, now), [
      'signup',
      'project_created',
      'note_created',
      'shared',
    ])
    expect(data).toHaveLength(4)
    for (let i = 1; i < data.length; i += 1)
      expect(data[i]!.users).toBeLessThanOrEqual(data[i - 1]!.users)
    // The seed spans exactly ninety days ending at seed time; a few signups sit just outside.
    expect(data[0]!.users).toBeGreaterThan(4900)
    expect(data[3]!.ofFirst).toBeGreaterThan(0.1)
  })
})
