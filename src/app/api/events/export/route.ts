import { csvStream } from '@/lib/csv-stream'
import { parseExplorer, parseRange } from '@/lib/params'
import { iterateEvents } from '@/lib/queries/events'

/** Streams the matching rows as CSV; see `csvStream` for the backpressure story. */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const params: Record<string, string[]> = {}
  for (const [k, v] of url.searchParams) (params[k] ??= []).push(v)
  const range = parseRange(params)
  const filters = parseExplorer({ ...params, cursor: undefined })
  const encoder = new TextEncoder()

  const stream = csvStream(iterateEvents(range, filters), encoder)

  const name = `events-${range.from.toISOString().slice(0, 10)}-${range.to.toISOString().slice(0, 10)}.csv`
  return new Response(stream, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${name}"`,
      'cache-control': 'no-store',
    },
  })
}
