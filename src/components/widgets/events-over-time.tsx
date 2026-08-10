import Link from 'next/link'

import { LineChart } from '@/components/charts/line-chart'
import { withParams, type Bucket, type DateRange, type SearchParams } from '@/lib/params'
import { timeseries } from '@/lib/queries/overview'

import { Card } from '../card'
import { QueryTime } from '../query-time'

export async function EventsOverTime({
  range,
  bucket,
  params,
}: {
  range: DateRange
  bucket: Bucket
  params: SearchParams
}) {
  const { data, ms } = await timeseries(range, bucket)
  const toggle = (
    <div role="group" aria-label="Bucket" className="flex gap-1 text-xs">
      {(['hour', 'day'] as const).map((b) => (
        <Link
          key={b}
          href={withParams(params, { bucket: b })}
          aria-current={bucket === b ? 'true' : undefined}
          className={`rounded px-2 py-0.5 ${bucket === b ? 'bg-ink text-bg' : 'text-muted hover:text-ink'}`}
        >
          per {b}
        </Link>
      ))}
    </div>
  )
  return (
    <Card title="Events over time" aside={toggle}>
      <LineChart
        points={data.map((p) => ({ t: p.t, value: p.events }))}
        label="events"
        bucket={bucket}
      />
      <QueryTime entries={[['timeseries', ms]]} />
    </Card>
  )
}
