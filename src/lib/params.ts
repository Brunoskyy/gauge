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
  /** The period of the same length ending where this one starts. */
  previousFrom: Date
  previousTo: Date
  preset: RangePreset | 'custom'
}

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

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

export function parseRange(params: SearchParams, now = new Date()): DateRange {
  const r = rangeSchema.safeParse({
    range: first(params.range),
    from: first(params.from),
    to: first(params.to),
  })
  const p = r.success ? r.data : {}
  const todayEnd = new Date(startOfUtcDay(now).getTime() + DAY)

  if (p.from && p.to) {
    const from = new Date(`${p.from}T00:00:00Z`)
    const to = new Date(new Date(`${p.to}T00:00:00Z`).getTime() + DAY)
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && to > from) {
      const length = to.getTime() - from.getTime()
      return {
        from,
        to,
        previousFrom: new Date(from.getTime() - length),
        previousTo: from,
        preset: 'custom',
      }
    }
  }
  const preset: RangePreset = p.range ?? '30d'
  const days = Number(preset.replace('d', ''))
  const from = new Date(todayEnd.getTime() - days * DAY)
  return {
    from,
    to: todayEnd,
    previousFrom: new Date(from.getTime() - days * DAY),
    previousTo: from,
    preset,
  }
}

export const BUCKETS = ['hour', 'day'] as const
export type Bucket = (typeof BUCKETS)[number]

/** Hour buckets up to three days; past that the chart would be a wall of points. */
export function chooseBucket(range: Pick<DateRange, 'from' | 'to'>): Bucket {
  return range.to.getTime() - range.from.getTime() <= 3 * DAY ? 'hour' : 'day'
}

export function parseBucket(params: SearchParams, range: DateRange): Bucket {
  const v = first(params.bucket)
  return v === 'hour' || v === 'day' ? v : chooseBucket(range)
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
