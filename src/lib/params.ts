import { z } from 'zod'

import { EVENT_NAMES } from './seed/generate'

/**
 * Every filter lives in the URL, parsed in one place. A bad value falls back
 * to the default instead of breaking the page, so a hand-edited link still
 * opens.
 */
export type SearchParams = Record<string, string | string[] | undefined>

const DAY = 86_400_000

export const RANGE_PRESETS = ['7d', '30d', '90d'] as const
export type RangePreset = (typeof RANGE_PRESETS)[number]

export interface DateRange {
  from: Date
  to: Date
  /**
   * The comparison window. It ends where the current one starts and is as
   * long as the part of the current window that has elapsed, so a range
   * that ends today (a partial day) is not compared against a full period.
   */
  previousFrom: Date
  previousTo: Date
  /** `to`, or now if the range runs into the future. What the deltas measure up to. */
  effectiveTo: Date
  preset: RangePreset | 'custom'
}

/** Custom ranges are clamped to this many days; hour buckets to this many. */
export const MAX_RANGE_DAYS = 400
export const MAX_HOUR_BUCKET_DAYS = 14
/** Dates before this are a typo, not a query. */
export const EARLIEST = new Date('2000-01-01T00:00:00Z')

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/** `2026-02-31` parses as March 3rd in JavaScript; only a real calendar date passes. */
export function parseUtcDay(text: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  const real =
    date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d
  return real ? date : null
}

const rangeSchema = z.object({
  range: z.enum(RANGE_PRESETS).optional(),
  from: isoDay.optional(),
  to: isoDay.optional(),
})

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

function list(v: string | string[] | undefined): string[] {
  if (v === undefined) return []
  const raw = Array.isArray(v) ? v : [v]
  return raw
    .flatMap((s) => s.split(','))
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Start of the UTC day. Aggregates are bucketed in UTC too, so the two agree. */
export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function withComparison(from: Date, to: Date, now: Date, preset: DateRange['preset']): DateRange {
  const effectiveTo = new Date(Math.min(to.getTime(), Math.max(now.getTime(), from.getTime())))
  const elapsed = effectiveTo.getTime() - from.getTime()
  return {
    from,
    to,
    previousFrom: new Date(from.getTime() - elapsed),
    previousTo: from,
    effectiveTo,
    preset,
  }
}

export function parseRange(params: SearchParams, now = new Date()): DateRange {
  const r = rangeSchema.safeParse({
    range: first(params.range),
    from: first(params.from),
    to: first(params.to),
  })
  const p = r.success ? r.data : {}
  const todayEnd = new Date(startOfUtcDay(now).getTime() + DAY)

  if (p.from && p.to) {
    const from = parseUtcDay(p.from)
    const toDay = parseUtcDay(p.to)
    if (from && toDay && from >= EARLIEST && from <= todayEnd && toDay >= from) {
      // End inclusive, then clamped to today and to the maximum span.
      const to = new Date(
        Math.min(toDay.getTime() + DAY, todayEnd.getTime(), from.getTime() + MAX_RANGE_DAYS * DAY),
      )
      if (to > from) return withComparison(from, to, now, 'custom')
    }
  }
  const preset: RangePreset = p.range ?? '30d'
  const days = Number(preset.replace('d', ''))
  const from = new Date(todayEnd.getTime() - days * DAY)
  return withComparison(from, todayEnd, now, preset)
}

export const BUCKETS = ['hour', 'day'] as const
export type Bucket = (typeof BUCKETS)[number]

/** Hour buckets up to three days by default; past that the chart would be a wall of points. */
export function chooseBucket(range: Pick<DateRange, 'from' | 'to'>): Bucket {
  return range.to.getTime() - range.from.getTime() <= 3 * DAY ? 'hour' : 'day'
}

/**
 * A requested bucket is honoured only where it makes sense: hours over a
 * year would be nine thousand points to draw and a query anyone could use
 * to tie the server up.
 */
export function parseBucket(params: SearchParams, range: DateRange): Bucket {
  const v = first(params.bucket)
  const days = (range.to.getTime() - range.from.getTime()) / DAY
  if (v === 'hour') return days <= MAX_HOUR_BUCKET_DAYS ? 'hour' : 'day'
  if (v === 'day') return 'day'
  return chooseBucket(range)
}

export const BREAKDOWNS = ['country', 'plan'] as const
export type Breakdown = (typeof BREAKDOWNS)[number]

export function parseBreakdown(params: SearchParams): Breakdown {
  const v = first(params.by)
  return v === 'plan' ? 'plan' : 'country'
}

export const PLANS = ['free', 'team', 'business'] as const
export type PlanName = (typeof PLANS)[number]

export interface ExplorerFilters {
  events: string[]
  plans: PlanName[]
  countries: string[]
  /** Parsed from `q`, applied with jsonb containment. */
  props: Record<string, string | number | boolean> | null
  q: string
  cursor: { ts: Date; id: bigint } | null
}

const eventName = z.enum(EVENT_NAMES)
const country = z.string().regex(/^[A-Z]{2}$/)

/**
 * `channel=link words>0` is not a query language; `q` is `key=value` pairs and
 * each pair becomes a jsonb containment check. Numbers and booleans are typed
 * so `words=500` matches the number, not the string.
 */
export function parseProps(q: string): Record<string, string | number | boolean> | null {
  const out: Record<string, string | number | boolean> = {}
  for (const part of q.split(/\s+/).filter(Boolean)) {
    const eq = part.indexOf('=')
    if (eq <= 0) continue
    const key = part.slice(0, eq)
    const raw = part.slice(eq + 1)
    if (!raw || !/^[a-zA-Z_][a-zA-Z0-9_]{0,30}$/.test(key)) continue
    if (raw === 'true' || raw === 'false') out[key] = raw === 'true'
    else if (/^-?\d+(\.\d+)?$/.test(raw)) out[key] = Number(raw)
    else out[key] = raw.slice(0, 80)
  }
  return Object.keys(out).length ? out : null
}

export function parseExplorer(params: SearchParams): ExplorerFilters {
  const events = list(params.event).filter(
    (e): e is (typeof EVENT_NAMES)[number] => eventName.safeParse(e).success,
  )
  const plans = list(params.plan).filter((p): p is PlanName =>
    (PLANS as readonly string[]).includes(p),
  )
  const countries = list(params.country).filter((c) => country.safeParse(c).success)
  const q = (first(params.q) ?? '').slice(0, 200)
  const cursor = parseCursor(first(params.cursor))
  return { events, plans, countries, props: parseProps(q), q, cursor }
}

/** `<ms>_<id>`: the last row's timestamp and id, for keyset pagination. */
export function parseCursor(v: string | undefined): { ts: Date; id: bigint } | null {
  if (!v) return null
  const m = /^(\d{1,15})_(\d{1,19})$/.exec(v)
  if (!m) return null
  return { ts: new Date(Number(m[1])), id: BigInt(m[2] as string) }
}

export function formatCursor(row: { ts: Date; id: bigint }): string {
  return `${row.ts.getTime()}_${row.id.toString()}`
}

export const DEFAULT_FUNNEL = ['signup', 'project_created', 'note_created', 'shared']
export const MAX_FUNNEL_STEPS = 6

export function parseFunnelSteps(params: SearchParams): string[] {
  const steps = list(params.steps).filter(
    (s): s is (typeof EVENT_NAMES)[number] => eventName.safeParse(s).success,
  )
  const unique = steps.filter((s, i) => steps.indexOf(s) === i).slice(0, MAX_FUNNEL_STEPS)
  return unique.length >= 2 ? unique : DEFAULT_FUNNEL
}

/** Builds a query string from the current params with some keys replaced. */
export function withParams(
  params: SearchParams,
  patch: Record<string, string | string[] | null>,
): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue
    for (const item of Array.isArray(v) ? v : [v]) sp.append(k, item)
  }
  for (const [k, v] of Object.entries(patch)) {
    sp.delete(k)
    if (v === null) continue
    for (const item of Array.isArray(v) ? v : [v]) sp.append(k, item)
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}
