import Link from 'next/link'

import { BarChart } from '@/components/charts/bar-chart'
import {
  BREAKDOWNS,
  withParams,
  type Breakdown,
  type DateRange,
  type SearchParams,
} from '@/lib/params'
import { breakdown } from '@/lib/queries/overview'

import { Card } from '../card'
import { QueryTime } from '../query-time'

export async function BreakdownWidget({
  range,
  by,
  params,
}: {
  range: DateRange
  by: Breakdown
  params: SearchParams
}) {
  const { data, ms } = await breakdown(range, by)
  const toggle = (
    <div role="group" aria-label="Breakdown" className="flex gap-1 text-xs">
      {BREAKDOWNS.map((b) => (
        <Link
          key={b}
          href={withParams(params, { by: b })}
          aria-current={by === b ? 'true' : undefined}
          className={`rounded px-2 py-0.5 ${by === b ? 'bg-ink text-bg' : 'text-muted hover:text-ink'}`}
        >
          by {b}
        </Link>
      ))}
    </div>
  )
  return (
    <Card title={`Events by ${by}`} aside={toggle}>
      <BarChart
        bars={data.map((r) => ({ key: r.key, value: r.events, secondary: r.users }))}
        label="events"
        secondaryLabel="users"
      />
      <QueryTime entries={[['breakdown', ms]]} />
    </Card>
  )
}
