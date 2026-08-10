import { EVENT_NAMES } from '@/lib/seed/generate'
import { PLANS, type ExplorerFilters, type SearchParams } from '@/lib/params'

/** A plain GET form: every control maps to a query key the page parses. */
export function ExplorerFilterForm({
  params,
  filters,
  countries,
}: {
  params: SearchParams
  filters: ExplorerFilters
  countries: string[]
}) {
  return (
    <form
      method="get"
      className="border-line bg-surface grid gap-4 rounded-xl border p-4 md:grid-cols-[1fr_auto_auto_1fr_auto]"
    >
      {['range', 'from', 'to'].map((k) => {
        const v = params[k]
        const s = Array.isArray(v) ? v[0] : v
        return s ? <input key={k} type="hidden" name={k} value={s} /> : null
      })}
      <fieldset>
        <legend className="text-muted mb-1 text-xs">Events</legend>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
          {EVENT_NAMES.map((n) => (
            <label key={n} className="flex items-center gap-1 font-mono text-xs">
              <input
                type="checkbox"
                name="event"
                value={n}
                defaultChecked={filters.events.includes(n)}
              />
              {n}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="text-muted text-xs">
        Plan
        <select
          name="plan"
          defaultValue={filters.plans[0] ?? ''}
          className="border-line bg-surface text-ink mt-1 block rounded-md border px-2 py-1 text-sm"
        >
          <option value="">any</option>
          {PLANS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <label className="text-muted text-xs">
        Country
        <select
          name="country"
          defaultValue={filters.countries[0] ?? ''}
          className="border-line bg-surface text-ink mt-1 block rounded-md border px-2 py-1 text-sm"
        >
          <option value="">any</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="text-muted text-xs">
        Props
        <input
          type="text"
          name="q"
          defaultValue={filters.q}
          placeholder="channel=link words=500"
          className="border-line bg-surface text-ink mt-1 block w-full rounded-md border px-2 py-1 font-mono text-xs"
        />
      </label>
      <div className="flex items-end">
        <button type="submit" className="bg-ink text-bg rounded-md px-3 py-1.5 text-sm">
          Filter
        </button>
      </div>
    </form>
  )
}
