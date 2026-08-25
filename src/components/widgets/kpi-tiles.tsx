import { delta, formatCount, formatDelta, formatPercent } from '@/lib/format'
import type { DateRange } from '@/lib/params'
import { CONVERSION_WINDOW_DAYS, kpisWithPrevious } from '@/lib/queries/overview'

import { QueryTime } from '../query-time'

/**
 * Four hero numbers with their change against the previous period. The
 * current window is counted only up to now, and the previous one is as long
 * as that elapsed part, so a range ending today is not compared against a
 * full period. The delta is text with a sign, colored second, so it reads
 * without the color.
 */
export async function KpiTiles({ range }: { range: DateRange }) {
  const { data, ms } = await kpisWithPrevious(range)
  const { current, previous } = data
  const conv = (k: typeof current) => (k.signups === 0 ? 0 : k.converted / k.signups)
  const tiles = [
    {
      label: 'Active users',
      value: formatCount(current.activeUsers),
      d: delta(current.activeUsers, previous.activeUsers),
    },
    {
      label: 'Events',
      value: formatCount(current.events),
      d: delta(current.events, previous.events),
    },
    {
      label: 'Sessions',
      value: formatCount(current.sessions),
      d: delta(current.sessions, previous.sessions),
    },
    {
      label: `Signup to share, within ${CONVERSION_WINDOW_DAYS} days`,
      value: formatPercent(conv(current)),
      d: delta(conv(current), conv(previous)),
      hint: `${formatCount(current.converted)} of ${formatCount(current.signups)} signups old enough to count`,
    },
  ]
  return (
    <div>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="border-line bg-surface rounded-xl border p-4">
            <dt className="text-muted text-xs">{t.label}</dt>
            <dd className="tabular mt-1 text-2xl font-semibold">{t.value}</dd>
            <dd className="mt-1 text-xs">
              <span
                className={t.d === null ? 'text-muted' : t.d >= 0 ? 'text-good' : 'text-critical'}
              >
                {formatDelta(t.d)}
              </span>
              <span className="text-muted">
                {' '}
                vs previous {range.preset === 'custom' ? 'period' : range.preset}
              </span>
              {t.hint && <span className="text-muted block">{t.hint}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <QueryTime entries={[['kpis', ms]]} />
    </div>
  )
}

export function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="border-line bg-surface h-24 animate-pulse rounded-xl border" />
      ))}
    </div>
  )
}
