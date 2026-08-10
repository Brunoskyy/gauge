import type { Metadata } from 'next'
import { Suspense } from 'react'

import { Card, Skeleton } from '@/components/card'
import { FunnelChart } from '@/components/charts/funnel-chart'
import { DateRangePicker } from '@/components/date-range'
import { QueryTime } from '@/components/query-time'
import {
  MAX_FUNNEL_STEPS,
  parseFunnelSteps,
  parseRange,
  type DateRange,
  type SearchParams,
} from '@/lib/params'
import { funnel } from '@/lib/queries/funnel'
import { EVENT_NAMES } from '@/lib/seed/generate'

export const metadata: Metadata = { title: 'Funnels' }
export const dynamic = 'force-dynamic'

async function FunnelWidget({ range, steps }: { range: DateRange; steps: string[] }) {
  const { data, ms } = await funnel(range, steps)
  return (
    <Card title="Users through each step, in order">
      <FunnelChart steps={data} />
      <QueryTime entries={[['funnel', ms]]} />
    </Card>
  )
}

/** Six selects, in order; empty ones are skipped, so a three-step funnel is three picks. */
function StepsForm({ params, steps }: { params: SearchParams; steps: string[] }) {
  return (
    <form method="get" className="border-line bg-surface rounded-xl border p-4">
      {['range', 'from', 'to'].map((k) => {
        const v = params[k]
        const s = Array.isArray(v) ? v[0] : v
        return s ? <input key={k} type="hidden" name={k} value={s} /> : null
      })}
      <fieldset className="flex flex-wrap items-end gap-3">
        <legend className="mb-2 text-sm font-medium">Steps</legend>
        {Array.from({ length: MAX_FUNNEL_STEPS }, (_, i) => (
          <label key={i} className="text-muted text-xs">
            {i + 1}
            <select
              name="steps"
              defaultValue={steps[i] ?? ''}
              className="border-line bg-surface text-ink mt-1 block rounded-md border px-2 py-1 font-mono text-xs"
            >
              <option value="">—</option>
              {EVENT_NAMES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ))}
        <button type="submit" className="bg-ink text-bg rounded-md px-3 py-1.5 text-sm">
          Run
        </button>
      </fieldset>
    </form>
  )
}

export default async function Funnels({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const range = parseRange(params)
  const steps = parseFunnelSteps(params)
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-semibold">Funnels</h1>
        <DateRangePicker params={params} range={range} />
      </div>
      <StepsForm params={params} steps={steps} />
      <Suspense
        fallback={
          <Card title="Users through each step, in order">
            <Skeleton height={200} />
          </Card>
        }
      >
        <FunnelWidget range={range} steps={steps} />
      </Suspense>
    </div>
  )
}
