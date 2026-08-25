import type { Metadata } from 'next'
import { Suspense } from 'react'

import { Card, Skeleton } from '@/components/card'
import { Heatmap } from '@/components/charts/heatmap'
import { DateRangePicker } from '@/components/date-range'
import { QueryTime } from '@/components/query-time'
import { parseRange, type DateRange, type SearchParams } from '@/lib/params'
import { retention } from '@/lib/queries/retention'

export const metadata: Metadata = { title: 'Retention' }
export const dynamic = 'force-dynamic'

async function RetentionWidget({ range }: { range: DateRange }) {
  const { data, ms } = await retention(range)
  return (
    <Card title="Weekly retention by signup cohort">
      <p className="text-muted mb-4 text-sm">
        Each row is everyone who signed up that week (Monday, UTC). Each cell is the share of them
        who did anything besides sign up during the week shown. Empty cells are weeks that have not
        happened yet; the dashed cell in each row is the week still in progress.
      </p>
      <Heatmap matrix={data} />
      <QueryTime entries={[['retention', ms]]} />
    </Card>
  )
}

export default async function Retention({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const range = parseRange(params)
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-semibold">Retention</h1>
        <DateRangePicker params={params} range={range} />
      </div>
      <Suspense
        fallback={
          <Card title="Weekly retention by signup cohort">
            <Skeleton height={320} />
          </Card>
        }
      >
        <RetentionWidget range={range} />
      </Suspense>
    </div>
  )
}
