import { csvLine } from './csv'
import type { EventRow } from './queries/events'

/**
 * Streams the matching rows as CSV, a thousand at a time, so a large export
 * starts downloading at once and never holds the whole result in memory.
 * The next page is only fetched when the consumer asks for more, so a slow
 * download slows the query instead of piling rows up on the server, and an
 * aborted download closes the iterator.
 */
export function csvStream(
  pages: AsyncGenerator<EventRow[]>,
  encoder = new TextEncoder(),
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          csvLine(['id', 'ts', 'name', 'user_id', 'session_id', 'plan', 'country', 'props']),
        ),
      )
    },
    async pull(controller) {
      try {
        const { value: page, done } = await pages.next()
        if (done) {
          controller.close()
          return
        }
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
      } catch (e) {
        controller.error(e)
      }
    },
    async cancel() {
      await pages.return(undefined)
    },
  })
}
