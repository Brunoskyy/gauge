import { NextResponse } from 'next/server'

import { formatCursor } from '@/lib/params'
import { parseExplorer, parseRange } from '@/lib/params'
import { listEvents } from '@/lib/queries/events'
import { toDto } from '@/lib/serialize'

/** The explorer's "next page": same filters as the page, plus a cursor. */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const params: Record<string, string[]> = {}
  for (const [k, v] of url.searchParams) (params[k] ??= []).push(v)
  const range = parseRange(params)
  const filters = parseExplorer(params)
  const { data } = await listEvents(range, filters)
  const last = data.rows[data.rows.length - 1]
  return NextResponse.json({
    rows: data.rows.map(toDto),
    nextCursor: data.hasMore && last ? formatCursor(last) : null,
  })
}
