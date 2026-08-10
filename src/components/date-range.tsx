import Link from 'next/link'

import { formatUtcDay } from '@/lib/format'
import { RANGE_PRESETS, withParams, type DateRange, type SearchParams } from '@/lib/params'

/**
 * Presets are links, so the range is in the address bar and in the history;
 * the custom form is a plain GET for the same reason.
 */
export function DateRangePicker({ params, range }: { params: SearchParams; range: DateRange }) {
  const toDay = new Date(range.to.getTime() - 1)
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        role="group"
        aria-label="Date range"
        className="border-line bg-surface flex rounded-lg border p-0.5 text-sm"
      >
        {RANGE_PRESETS.map((p) => (
          <Link
            key={p}
            href={withParams(params, { range: p, from: null, to: null, cursor: null })}
            aria-current={range.preset === p ? 'true' : undefined}
            className={`rounded-md px-3 py-1 ${range.preset === p ? 'bg-ink text-bg' : 'text-muted hover:text-ink'}`}
          >
            {p}
          </Link>
        ))}
      </div>
      <form method="get" className="flex flex-wrap items-center gap-2 text-sm">
        {Object.entries(params)
          .filter(([k]) => !['range', 'from', 'to', 'cursor'].includes(k))
          .flatMap(([k, v]) =>
            (Array.isArray(v) ? v : v ? [v] : []).map((item, i) => (
              <input key={`${k}${i}`} type="hidden" name={k} value={item} />
            )),
          )}
        <label className="text-muted">
          <span className="sr-only">From</span>
          <input
            type="date"
            name="from"
            defaultValue={formatUtcDay(range.from)}
            className="border-line bg-surface rounded-md border px-2 py-1"
            required
          />
        </label>
        <span className="text-muted">to</span>
        <label className="text-muted">
          <span className="sr-only">To</span>
          <input
            type="date"
            name="to"
            defaultValue={formatUtcDay(toDay)}
            className="border-line bg-surface rounded-md border px-2 py-1"
            required
          />
        </label>
        <button
          type="submit"
          className="border-line bg-surface hover:bg-bg rounded-md border px-3 py-1"
        >
          Apply
        </button>
      </form>
      <span className="text-muted font-mono text-xs">
        {formatUtcDay(range.from)} to {formatUtcDay(toDay)}, UTC
      </span>
    </div>
  )
}
