import { describe, expect, it } from 'vitest'

import { csvCell, csvLine } from '../csv'
import { delta, formatCount, formatDelta, formatPercent } from '../format'
import { shapeFunnel } from '../funnel'
import { shapeRetention } from '../retention'

describe('csv', () => {
  it('quotes only what needs quoting', () => {
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"')
    expect(csvCell(null)).toBe('')
    expect(csvCell({ a: 1 })).toBe('"{""a"":1}"')
    expect(csvLine([1, 'x', null])).toBe('1,x,\r\n')
  })
})

describe('format', () => {
  it('formats counts, percents and deltas', () => {
    expect(formatCount(999)).toBe('999')
    expect(formatCount(302338)).toBe('302.3K')
    expect(formatPercent(0.1234)).toBe('12.3%')
    expect(delta(110, 100)).toBeCloseTo(0.1)
    expect(delta(5, 0)).toBeNull()
    expect(delta(0, 0)).toBe(0)
    expect(formatDelta(0.1)).toBe('+10.0%')
    expect(formatDelta(-0.05)).toBe('-5.0%')
    expect(formatDelta(null)).toBe('new')
  })
})

describe('shapeRetention', () => {
  const w = (n: number) => new Date(Date.UTC(2026, 8, 7) + n * 7 * 86_400_000)
  const now = new Date(Date.UTC(2026, 8, 30))

  it('builds a triangle with nulls in the future', () => {
    const sizes = [
      { cohort: w(0), size: 100 },
      { cohort: w(1), size: 50 },
      { cohort: w(3), size: 10 },
    ]
    const rows = [
      { cohort: w(0), weekNo: 1, users: 40 },
      { cohort: w(0), weekNo: 2, users: 25 },
      { cohort: w(1), weekNo: 1, users: 10 },
    ]
    const m = shapeRetention(rows, sizes, now)
    expect(m.weeks).toBe(4)
    expect(m.cohorts[0]?.cells.map((c) => c?.users ?? null)).toEqual([100, 40, 25, 0])
    expect(m.cohorts[0]?.cells[1]?.ratio).toBeCloseTo(0.4)
    expect(m.cohorts[1]?.cells.map((c) => c?.users ?? null)).toEqual([50, 10, 0, null])
    expect(m.cohorts[2]?.cells.map((c) => c?.users ?? null)).toEqual([10, null, null, null])
  })

  it('flags the week containing now as partial, and only that one', () => {
    const sizes = [
      { cohort: w(0), size: 100 },
      { cohort: w(3), size: 10 },
    ]
    const m = shapeRetention([], sizes, now)
    // now is 23 days after w(0): weeks 0..2 are complete, week 3 is in progress.
    expect(m.cohorts[0]?.cells.map((c) => c?.partial ?? null)).toEqual([false, false, false, true])
    expect(m.cohorts[1]?.cells.map((c) => c?.partial ?? null)).toEqual([true, null, null, null])
  })

  it('handles no cohorts', () => {
    expect(shapeRetention([], [], now)).toEqual({ cohorts: [], weeks: 0 })
  })
})

describe('shapeFunnel', () => {
  it('computes shares of the first and previous steps', () => {
    const f = shapeFunnel(['a', 'b', 'c'], [200, 50, 10])
    expect(f.map((s) => s.ofFirst)).toEqual([1, 0.25, 0.05])
    expect(f.map((s) => s.ofPrevious)).toEqual([1, 0.25, 0.2])
  })

  it('does not divide by zero', () => {
    const f = shapeFunnel(['a', 'b'], [0, 0])
    expect(f.map((s) => [s.ofFirst, s.ofPrevious])).toEqual([
      [0, 1],
      [0, 0],
    ])
  })
})
