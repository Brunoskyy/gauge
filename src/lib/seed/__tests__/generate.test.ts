import { describe, expect, it } from 'vitest'

import { generate } from '../generate'
import { makeRng } from '../random'

describe('seed generator', () => {
  const now = new Date('2026-09-30T12:00:00Z')

  it('is deterministic for a seed', () => {
    const a = generate({ users: 50, now, seed: 7 })
    const b = generate({ users: 50, now, seed: 7 })
    expect(a.events.map((e) => [e.name, e.ts.getTime()])).toEqual(
      b.events.map((e) => [e.name, e.ts.getTime()]),
    )
    expect(generate({ users: 50, now, seed: 8 }).events.length).not.toBe(a.events.length)
  })

  it('keeps every event inside the window and after its user signed up', () => {
    const { users, events } = generate({ users: 200, now, days: 30 })
    const start = now.getTime() - 30 * 86_400_000
    const signup = new Map(users.map((u) => [u.id, u.signedUpAt.getTime()]))
    for (const e of events) {
      expect(e.ts.getTime()).toBeGreaterThanOrEqual(start)
      expect(e.ts.getTime()).toBeLessThan(now.getTime())
      expect(e.ts.getTime()).toBeGreaterThanOrEqual(signup.get(e.userId)!)
    }
    expect(events.filter((e) => e.name === 'signup')).toHaveLength(users.length)
  })

  it('leaks at every funnel step and is sorted by time', () => {
    const { events } = generate({ users: 500, now })
    const count = (n: string) =>
      new Set(events.filter((e) => e.name === n).map((e) => e.userId)).size
    expect(count('signup')).toBeGreaterThan(count('project_created'))
    expect(count('project_created')).toBeGreaterThan(count('shared'))
    for (let i = 1; i < events.length; i += 1)
      expect(events[i]!.ts.getTime()).toBeGreaterThanOrEqual(events[i - 1]!.ts.getTime())
  })

  it('has a weekday peak', () => {
    const { events } = generate({ users: 800, now })
    const byDay = Array.from({ length: 7 }, () => 0)
    for (const e of events) byDay[e.ts.getUTCDay()]! += 1
    const weekend = byDay[0]! + byDay[6]!
    const weekdays = byDay.slice(1, 6).reduce((a, b) => a + b, 0) / 5
    expect(weekend / 2).toBeLessThan(weekdays * 0.7)
  })

  it('the rng helpers stay in range', () => {
    const rng = makeRng(1)
    for (let i = 0; i < 1000; i += 1) {
      const n = rng.int(3, 5)
      expect(n).toBeGreaterThanOrEqual(3)
      expect(n).toBeLessThanOrEqual(5)
    }
    expect(
      rng.weighted([
        ['a', 0],
        ['b', 1],
      ]),
    ).toBe('b')
    expect(rng.id(6)).toMatch(/^[a-z0-9]{6}$/)
  })
})
