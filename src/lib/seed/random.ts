/**
 * A small seeded PRNG (mulberry32) so the demo data is the same on every
 * machine: screenshots, tests and the README all describe the same numbers.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Rng {
  next(): number
  int(min: number, maxInclusive: number): number
  chance(p: number): boolean
  pick<T>(items: readonly T[]): T
  weighted<T>(items: readonly [T, number][]): T
  /** Approximately normal, via the sum of three uniforms. */
  normal(mean: number, sd: number): number
  id(length?: number): string
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

export function makeRng(seed: number): Rng {
  const next = mulberry32(seed)
  const rng: Rng = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (items) => items[Math.floor(next() * items.length)] as (typeof items)[number],
    weighted: (items) => {
      const total = items.reduce((s, [, w]) => s + w, 0)
      let r = next() * total
      for (const [item, w] of items) {
        r -= w
        if (r <= 0) return item
      }
      return items[items.length - 1]![0]
    },
    normal: (mean, sd) => mean + sd * ((next() + next() + next()) / 3 - 0.5) * 3.46,
    id: (length = 12) => {
      let s = ''
      for (let i = 0; i < length; i += 1) s += ALPHABET[Math.floor(next() * ALPHABET.length)]
      return s
    },
  }
  return rng
}
