// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { EventRow } from '@/lib/queries/events'

import { csvStream } from '@/lib/csv-stream'

const row = (id: number): EventRow => ({
  id: BigInt(id),
  ts: new Date(1_700_000_000_000 + id),
  name: 'shared',
  userId: 'u1',
  sessionId: 's1',
  plan: 'free',
  country: 'BR',
  props: { channel: 'link' },
})

describe('csvStream', () => {
  it('fetches a page only when the consumer pulls, and closes the iterator on cancel', async () => {
    let fetched = 0
    let closed = false
    async function* pages(): AsyncGenerator<EventRow[]> {
      try {
        for (;;) {
          fetched += 1
          yield [row(fetched)]
        }
      } finally {
        closed = true
      }
    }
    const reader = csvStream(pages()).getReader()
    const decode = (v: Uint8Array | undefined) => new TextDecoder().decode(v)
    expect(decode((await reader.read()).value)).toMatch(/^id,ts,name/)
    expect(decode((await reader.read()).value)).toMatch(/^1,2023/)
    expect(decode((await reader.read()).value)).toMatch(/^2,2023/)
    // Two rows read; the generator has not run ahead by more than the stream's own high-water mark.
    expect(fetched).toBeLessThanOrEqual(4)
    await reader.cancel()
    expect(closed).toBe(true)
  })

  it('ends the stream when the pages run out', async () => {
    async function* pages(): AsyncGenerator<EventRow[]> {
      yield [row(1)]
    }
    const text = await new Response(csvStream(pages())).text()
    expect(text.split('\r\n').filter(Boolean)).toHaveLength(2)
  })
})
