import { Suspense } from 'react'

import { Card, Skeleton } from '@/components/card'
import { DateRangePicker } from '@/components/date-range'
import { BreakdownWidget } from '@/components/widgets/breakdown'
import { EventsOverTime } from '@/components/widgets/events-over-time'
import { KpiSkeleton, KpiTiles } from '@/components/widgets/kpi-tiles'
import { parseBreakdown, parseBucket, parseRange, type SearchParams } from '@/lib/params'

export const dynamic = 'force-dynamic'

export default async function Overview({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const range = parseRange(params)
  const bucket = parseBucket(params, range)
  const by = parseBreakdown(params)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-semibold">Overview</h1>
        <DateRangePicker params={params} range={range} />
      </div>
      <Suspense fallback={<KpiSkeleton />}>
        <KpiTiles range={range} />
      </Suspense>
      <Suspense
        fallback={
          <Card title="Events over time">
            <Skeleton />
          </Card>
        }
      >
        <EventsOverTime range={range} bucket={bucket} params={params} />
      </Suspense>
      <Suspense
        fallback={
          <Card title={`Events by ${by}`}>
            <Skeleton height={200} />
          </Card>
        }
      >
        <BreakdownWidget range={range} by={by} params={params} />
      </Suspense>
    </div>
  )
}
