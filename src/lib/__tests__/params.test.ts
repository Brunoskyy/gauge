import { describe, expect, it } from 'vitest'

import {
  chooseBucket,
  formatCursor,
  parseBucket,
  parseBreakdown,
  parseCursor,
  parseExplorer,
  parseFunnelSteps,
  parseProps,
  parseRange,
  withParams,
} from '../params'

const now = new Date('2026-09-30T15:30:00Z')

describe('parseRange', () => {
  it('defaults to 30 days ending at the end of today, UTC', () => {
    const r = parseRange({}, now)
    expect(r.preset).toBe('30d')
    expect(r.to.toISOString()).toBe('2026-10-01T00:00:00.000Z')
    expect(r.from.toISOString()).toBe('2026-09-01T00:00:00.000Z')
    expect(r.previousTo).toEqual(r.from)
    expect(r.previousFrom.toISOString()).toBe('2026-08-02T00:00:00.000Z')
  })

  it('honours presets and ignores junk', () => {
    expect(parseRange({ range: '7d' }, now).from.toISOString()).toBe('2026-09-24T00:00:00.000Z')
    expect(parseRange({ range: '1000d' }, now).preset).toBe('30d')
    expect(parseRange({ range: ['90d', '7d'] }, now).preset).toBe('90d')
  })

  it('takes a custom range as whole days, end inclusive', () => {
    const r = parseRange({ from: '2026-09-01', to: '2026-09-03' }, now)
    expect(r.preset).toBe('custom')
    expect(r.from.toISOString()).toBe('2026-09-01T00:00:00.000Z')
    expect(r.to.toISOString()).toBe('2026-09-04T00:00:00.000Z')
    expect(r.previousFrom.toISOString()).toBe('2026-08-29T00:00:00.000Z')
  })

  it('falls back when the custom range is inverted or malformed', () => {
    expect(parseRange({ from: '2026-09-05', to: '2026-09-01' }, now).preset).toBe('30d')
    expect(parseRange({ from: '2026-13-40', to: '2026-09-01' }, now).preset).toBe('30d')
    expect(parseRange({ from: 'yesterday', to: 'today' }, now).preset).toBe('30d')
  })
})

describe('buckets and breakdowns', () => {
  it('uses hours only for short ranges', () => {
    expect(chooseBucket({ from: new Date('2026-09-01'), to: new Date('2026-09-03') })).toBe('hour')
    expect(chooseBucket({ from: new Date('2026-09-01'), to: new Date('2026-09-05') })).toBe('day')
  })

  it('lets the URL override the bucket, within the two that exist', () => {
    const r = parseRange({ range: '30d' }, now)
    expect(parseBucket({ bucket: 'hour' }, r)).toBe('hour')
    expect(parseBucket({ bucket: 'week' }, r)).toBe('day')
  })

  it('defaults the breakdown to country', () => {
    expect(parseBreakdown({})).toBe('country')
    expect(parseBreakdown({ by: 'plan' })).toBe('plan')
    expect(parseBreakdown({ by: 'user' })).toBe('country')
  })
})

describe('explorer filters', () => {
  it('keeps only known event names, plans and countries', () => {
    const f = parseExplorer({
      event: ['shared', 'nope', 'search,export'],
      plan: 'team,gold',
      country: ['BR', 'brazil'],
    })
    expect(f.events).toEqual(['shared', 'search', 'export'])
    expect(f.plans).toEqual(['team'])
    expect(f.countries).toEqual(['BR'])
  })

  it('types prop filters', () => {
    expect(parseProps('channel=link words=500 ok=true bad junk= =x')).toEqual({
      channel: 'link',
      words: 500,
      ok: true,
    })
    expect(parseProps('')).toBeNull()
    expect(parseProps('$where=1')).toBeNull()
  })

  it('round-trips the cursor and rejects other shapes', () => {
    const row = { ts: new Date('2026-09-30T10:00:00.123Z'), id: 123456789012345n }
    expect(parseCursor(formatCursor(row))).toEqual(row)
    expect(parseCursor('abc')).toBeNull()
    expect(parseCursor('1_')).toBeNull()
    expect(parseExplorer({ cursor: '1' }).cursor).toBeNull()
  })
})

describe('funnel steps', () => {
  it('defaults when fewer than two valid steps remain', () => {
    expect(parseFunnelSteps({})).toEqual(['signup', 'project_created', 'note_created', 'shared'])
    expect(parseFunnelSteps({ steps: 'signup' })).toHaveLength(4)
    expect(parseFunnelSteps({ steps: 'signup,shared,shared,bogus' })).toEqual(['signup', 'shared'])
  })

  it('caps the number of steps', () => {
    const steps = parseFunnelSteps({
      steps: 'signup,app_opened,project_created,note_created,note_edited,shared,search,export',
    })
    expect(steps).toHaveLength(6)
  })
})

describe('withParams', () => {
  it('patches keys and drops nulls', () => {
    expect(withParams({ range: '7d', by: 'plan' }, { by: null, bucket: 'hour' })).toBe(
      '?range=7d&bucket=hour',
    )
    expect(withParams({}, {})).toBe('')
    expect(withParams({ event: ['a', 'b'] }, { event: ['c'] })).toBe('?event=c')
  })
})
