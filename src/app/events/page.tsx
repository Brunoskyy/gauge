import type { Metadata } from 'next'
import { Suspense } from 'react'

import { Skeleton } from '@/components/card'
import { DateRangePicker } from '@/components/date-range'
import { EventsTable } from '@/components/explorer/events-table'
import { ExplorerFilterForm } from '@/components/explorer/filters'
import { QueryTime } from '@/components/query-time'
import {
  formatCursor,
  parseExplorer,
  parseRange,
  withParams,
  type DateRange,
  type ExplorerFilters,
  type SearchParams,
} from '@/lib/params'
import { countEvents, distinctCountries, listEvents } from '@/lib/queries/events'
import { toDto } from '@/lib/serialize'

export const metadata: Metadata = { title: 'Events' }
export const dynamic = 'force-dynamic'

async function Results({
  range,
  filters,
  params,
}: {
  range: DateRange
  filters: ExplorerFilters
  params: SearchParams
}) {
  const [page, total] = await Promise.all([listEvents(range, filters), countEvents(range, filters)])
  const last = page.data.rows[page.data.rows.length - 1]
  return (
    <div>
      <EventsTable
        initial={page.data.rows.map(toDto)}
        nextCursor={page.data.hasMore && last ? formatCursor(last) : null}
        query={withParams(params, { cursor: null })}
        total={total.data}
      />
      <QueryTime
        entries={[
          ['page', page.ms],
          ['count', total.ms],
        ]}
      />
    </div>
  )
}

export default async function Events({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const range = parseRange(params)
  const filters = parseExplorer(params)
  const countries = await distinctCountries()
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-semibold">Events</h1>
        <DateRangePicker params={params} range={range} />
      </div>
      <ExplorerFilterForm params={params} filters={filters} countries={countries.data} />
      <Suspense fallback={<Skeleton height={600} />}>
        <Results range={range} filters={filters} params={params} />
      </Suspense>
    </div>
  )
}
