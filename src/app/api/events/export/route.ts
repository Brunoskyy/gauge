import { csvLine } from '@/lib/csv'
import { parseExplorer, parseRange } from '@/lib/params'
import { iterateEvents } from '@/lib/queries/events'

/**
 * Streams the matching rows as CSV, a thousand at a time, so a large export
 * starts downloading at once and never holds the whole result in memory.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const params: Record<string, string[]> = {}
  for (const [k, v] of url.searchParams) (params[k] ??= []).push(v)
  const range = parseRange(params)
  const filters = parseExplorer({ ...params, cursor: undefined })
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(
        encoder.encode(
          csvLine(['id', 'ts', 'name', 'user_id', 'session_id', 'plan', 'country', 'props']),
        ),
      )
      try {
        for await (const page of iterateEvents(range, filters)) {
          let chunk = ''
          for (const r of page) {
            chunk += csvLine([
              r.id.toString(),
              r.ts.toISOString(),
              r.name,
              r.userId,
              r.sessionId,
              r.plan,
              r.country,
              r.props,
            ])
          }
          controller.enqueue(encoder.encode(chunk))
        }
        controller.close()
      } catch (e) {
        controller.error(e)
      }
    },
  })

  const name = `events-${range.from.toISOString().slice(0, 10)}-${range.to.toISOString().slice(0, 10)}.csv`
  return new Response(stream, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${name}"`,
      'cache-control': 'no-store',
    },
  })
}
